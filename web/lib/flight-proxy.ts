/**
 * Module 1: Resilient Multi-Tier Flight Telemetry Proxy & Credit Governor
 * 
 * Spec: flight-tracking-3d-implementation-guide.md (Module 1)
 * Features:
 * - OAuth2 token negotiation with request coalescing
 * - Credit governor with adaptive TTL (9s - 30s) based on OpenSky remaining budget
 * - HTTP 429 rate-limit backoff
 * - Fail-soft stale caching
 * - adsb.lol regional bounding fallback with readsb -> OpenSky 18-element normalization
 */

import { getOpenSkyCredentials } from "./opensky-auth";

const OPENSKY_TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const OPENSKY_API_URL = "https://opensky-network.org/api/states/all?extended=1";
const ADSBLOL_POINT_URL = "https://api.adsb.lol/v2/lat";

let openskyToken: string | null = null;
let openskyTokenExpiry = 0;
let openskyTokenPromise: Promise<string | null> | null = null;

let cacheBody: string | null = null;
let cacheTime = 0;
let cooldownUntil = 0;
let currentTtlMs = 9000;
let lastSource = "OpenSky Network";

// OAuth2 Token Refresher with Request Coalescing
export async function getOpenSkyToken(clientId?: string, clientSecret?: string): Promise<string | null> {
  const creds = clientId && clientSecret ? { clientId, clientSecret } : getOpenSkyCredentials();
  if (!creds?.clientId || !creds?.clientSecret) return null;

  const now = Date.now();
  if (openskyToken && now < openskyTokenExpiry - 60000) return openskyToken;
  if (openskyTokenPromise) return openskyTokenPromise;

  openskyTokenPromise = (async () => {
    try {
      const res = await fetch(OPENSKY_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=client_credentials&client_id=${encodeURIComponent(creds.clientId)}&client_secret=${encodeURIComponent(creds.clientSecret)}`,
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) return null;
      openskyToken = data.access_token;
      openskyTokenExpiry = Date.now() + (Number(data.expires_in) || 1800) * 1000;
      return openskyToken;
    } catch {
      return null;
    } finally {
      openskyTokenPromise = null;
    }
  })();

  return openskyTokenPromise;
}

// Convert adsb.lol readsb JSON into OpenSky's 18-element state vector array
export function normalizeAdsbLolToOpenSky(payload: any) {
  const nowSeconds = Math.floor((payload?.now || Date.now()) / 1000);
  const KNOT_TO_MPS = 0.514444;
  const FOOT_TO_M = 0.3048;

  const states = (payload?.ac || [])
    .map((ac: any) => {
      if (!ac.hex || ac.lat == null || ac.lon == null) return null;
      const onGround = ac.alt_baro === "ground";
      const baroM = onGround ? null : Number.isFinite(ac.alt_baro) ? ac.alt_baro * FOOT_TO_M : null;
      const geomM = Number.isFinite(ac.alt_geom) ? ac.alt_geom * FOOT_TO_M : null;
      const speedMps = Number.isFinite(ac.gs) ? ac.gs * KNOT_TO_MPS : null;

      return [
        String(ac.hex).toLowerCase(), // [0] icao24
        String(ac.flight || ac.r || "").trim(), // [1] callsign
        null, // [2] origin_country
        nowSeconds - (ac.seen_pos || 0), // [3] time_position
        nowSeconds - (ac.seen || 0), // [4] last_contact
        ac.lon, // [5] longitude
        ac.lat, // [6] latitude
        baroM, // [7] baro_altitude
        onGround, // [8] on_ground
        speedMps, // [9] velocity (m/s)
        ac.track ?? null, // [10] true_track (deg)
        Number.isFinite(ac.baro_rate) ? ac.baro_rate * 0.00508 : null, // [11] vertical_rate (m/s)
        null, // [12] sensors
        geomM, // [13] geo_altitude (m, WGS84)
        ac.squawk || null, // [14] squawk
        ac.spi === 1, // [15] spi
        0, // [16] position_source
        ac.category ? parseInt(String(ac.category).replace(/\D/g, "") || "0", 10) : 0, // [17] category
      ];
    })
    .filter(Boolean);

  return { time: nowSeconds, states };
}

export interface ProxyResult {
  status: number;
  data: any;
  source: string;
  cacheStatus: "HIT" | "MISS" | "STALE" | "FALLBACK";
}

/**
 * Executes multi-tier flight query with credit governor and fail-soft fallbacks
 */
export async function fetchProxyFlights(lat: number, lon: number): Promise<ProxyResult> {
  const now = Date.now();

  // 1. Serve fresh cache if still within adaptive TTL or in 429 cooldown
  if (cacheBody && (now - cacheTime < currentTtlMs || now < cooldownUntil)) {
    const isStale = now - cacheTime >= currentTtlMs;
    try {
      const parsed = JSON.parse(cacheBody);
      return {
        status: 200,
        data: parsed,
        source: lastSource,
        cacheStatus: isStale ? "STALE" : "HIT",
      };
    } catch {
      // In case of corrupt cache, fall through
    }
  }

  // 2. Query upstream OpenSky if not cooling down
  if (now >= cooldownUntil) {
    try {
      const token = await getOpenSkyToken();
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const upstream = await fetch(OPENSKY_API_URL, {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      // Handle Rate Limit (HTTP 429)
      if (upstream.status === 429) {
        const retryAfterSec = parseInt(upstream.headers.get("x-rate-limit-retry-after-seconds") || "120", 10);
        cooldownUntil = now + Math.min(Math.max(retryAfterSec, 30), 1800) * 1000;
        if (cacheBody) {
          return {
            status: 200,
            data: JSON.parse(cacheBody),
            source: "OpenSky (Rate Limited)",
            cacheStatus: "STALE",
          };
        }
      } else if (upstream.ok) {
        const bodyText = await upstream.text();
        const remaining = parseInt(upstream.headers.get("x-rate-limit-remaining") || "4000", 10);
        // Credit governor: scale TTL as remaining API credits deplete
        currentTtlMs = remaining > 2400 ? 9000 : remaining > 1000 ? 15000 : 30000;
        cacheBody = bodyText;
        cacheTime = now;
        lastSource = "OpenSky Network (Live)";

        return {
          status: 200,
          data: JSON.parse(bodyText),
          source: lastSource,
          cacheStatus: "MISS",
        };
      }
    } catch (err: any) {
      console.warn("[FlightProxy] OpenSky fetch failed, evaluating fallback:", err?.message || err);
    }
  }

  // 3. Fail-soft: if cache exists, serve it
  if (cacheBody) {
    try {
      return {
        status: 200,
        data: JSON.parse(cacheBody),
        source: "OpenSky Cache",
        cacheStatus: "STALE",
      };
    } catch {
      // Fall through
    }
  }

  // 4. Regional Fallback: adsb.lol 250nm bounding circle around target coordinates
  try {
    const roundedLat = Math.round((lat || 50.1109) * 4) / 4;
    const roundedLon = Math.round((lon || 8.6821) * 4) / 4;
    let adsbUrl = `${ADSBLOL_POINT_URL}/${roundedLat}/lon/${roundedLon}/dist/250`;

    let fallbackRes = await fetch(adsbUrl, {
      headers: { "User-Agent": "RouteCO2-Console/1.0 (ETHOnline2026; FlightOperations)" },
      signal: AbortSignal.timeout(8000),
    });
    let payload = fallbackRes.ok ? await fallbackRes.json() : null;
    let normalized = payload ? normalizeAdsbLolToOpenSky(payload) : null;

    // If local ocean point has zero aircraft, fall back to European / Transatlantic corridor
    if (!normalized || normalized.states.length === 0) {
      const busyCorridorUrl = `${ADSBLOL_POINT_URL}/50.1109/lon/8.6821/dist/250`;
      fallbackRes = await fetch(busyCorridorUrl, {
        headers: { "User-Agent": "RouteCO2-Console/1.0 (ETHOnline2026; FlightOperations)" },
        signal: AbortSignal.timeout(8000),
      });
      if (fallbackRes.ok) {
        payload = await fallbackRes.json();
        normalized = normalizeAdsbLolToOpenSky(payload);
      }
    }

    if (normalized && normalized.states.length > 0) {
      lastSource = "adsb.lol (Live Transponder Network)";
      cacheBody = JSON.stringify(normalized);
      cacheTime = now;
      return {
        status: 200,
        data: normalized,
        source: lastSource,
        cacheStatus: "FALLBACK",
      };
    }
  } catch (fallbackErr: any) {
    console.error("[FlightProxy] adsb.lol fallback failed:", fallbackErr?.message || fallbackErr);
  }

  // 5. Global fallback to ADS-B network if point fallback failed
  try {
    const globalAdsb = await fetch("https://api.adsb.lol/v2/mil", {
      headers: { "User-Agent": "RouteCO2-Console/1.0 (ETHOnline2026; FlightOperations)" },
      signal: AbortSignal.timeout(6000),
    });
    if (globalAdsb.ok) {
      const payload = await globalAdsb.json();
      const normalized = normalizeAdsbLolToOpenSky(payload);
      return {
        status: 200,
        data: normalized,
        source: "adsb.lol (Global)",
        cacheStatus: "FALLBACK",
      };
    }
  } catch {
    // Return empty state
  }

  return {
    status: 502,
    data: { error: "Flight data sources temporarily unavailable", time: Math.floor(Date.now() / 1000), states: [] },
    source: "Error",
    cacheStatus: "MISS",
  };
}
