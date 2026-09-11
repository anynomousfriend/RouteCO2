import { NextRequest, NextResponse } from "next/server";
import { getOpenSkyBearerToken } from "@/lib/opensky-auth";

export const dynamic = "force-dynamic";

import { type LiveFlightSummary } from "@/lib/replay-scenarios";
export type { LiveFlightSummary };

// In-memory cache to maintain high-frequency UI updates without hammering APIs
let cachedFlights: LiveFlightSummary[] = [];
let lastFetchTime = 0;
let lastSource = "ADS-B Radar";
const CACHE_TTL_MS = 10000; // 10 seconds cache
// Upstream throttle state: a 429 starts a cooldown instead of a hammer loop,
// or both sources throttle the IP and the radar goes dark for everyone.
let openskyCooldownUntil = 0;
let adsbCooldownUntil = 0;

/**
 * Fetches live ADS-B telemetry from OpenSky Network (with OAuth2 Bearer Auth or Basic Auth).
 * Airborne states are included normally. On-ground states are ALSO included for
 * explicitly watched/armed icao24s (?watch=hex1,hex2) so touchdown detection
 * (airborne→ground transition) works even when OpenSky — not the adsb.lol
 * fallback — is the active source. Without this, a watched landing would
 * silently vanish from the feed instead of flipping to LANDED_RECORDED.
 */
async function fetchFromOpenSky(searchParams: URLSearchParams): Promise<LiveFlightSummary[] | null> {
  const isGlobal = searchParams.get("all") === "true";
  const lamin = searchParams.get("lamin") || "35";
  const lomin = searchParams.get("lomin") || "-15";
  const lamax = searchParams.get("lamax") || "60";
  const lomax = searchParams.get("lomax") || "30";

  const queryUrl = isGlobal
    ? "https://opensky-network.org/api/states/all"
    : `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "RouteCO2-Console/1.0 (ETHOnline2026; FlightOperations)",
  };

  const bearerToken = await getOpenSkyBearerToken();
  if (bearerToken) {
    headers["Authorization"] = `Bearer ${bearerToken}`;
  } else if (process.env.OPENSKY_USERNAME && process.env.OPENSKY_PASSWORD) {
    const basic = Buffer.from(
      `${process.env.OPENSKY_USERNAME}:${process.env.OPENSKY_PASSWORD}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${basic}`;
  }

  const doFetch = async (h: Record<string, string>): Promise<Response | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(queryUrl, { signal: controller.signal, headers: h });
      clearTimeout(timeoutId);
      return response;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  };

  try {
    if (Date.now() < openskyCooldownUntil) return null;
    let response = await doFetch(headers);
    if (response && response.status === 429) {
      // Authenticated bucket exhausted (heavy polling day): honor Retry-After,
      // then retry once WITHOUT credentials — the anonymous bucket is independent.
      const wait = Math.min(Math.max(parseInt(response.headers.get("x-rate-limit-retry-after-seconds") || "60", 10) || 60, 30), 1800);
      openskyCooldownUntil = Date.now() + wait * 1000;
      console.warn(`[OpenSky] 429: cooling ${wait}s; retrying anonymous bucket once`);
      const anon = { ...headers };
      delete anon["Authorization"];
      response = await doFetch(anon);
      if (response && response.status === 429) {
        console.warn("[OpenSky] anonymous bucket also throttled");
        return null;
      }
    }

    if (!response || !response.ok) {
      console.warn(`[OpenSky API] Query returned status ${response ? response.status : "network-error"}`);
      return null;
    }

    const data = (await response.json()) as { states: (string | number | boolean | null)[][] };
    if (!data.states || !Array.isArray(data.states)) {
      return null;
    }

    const watchSet = new Set(
      (searchParams.get("watch") || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[0-9a-f]{4,6}$/.test(s))
    );

    const filtered: LiveFlightSummary[] = [];
    for (const s of data.states) {
      const icao = typeof s[0] === "string" ? String(s[0]).toLowerCase() : "";
      const isWatched = icao !== "" && watchSet.has(icao);
      const onGroundState = s[8] === true;
      // Watched/armed aircraft are included even when on the ground (touchdown
      // detection); everything else stays airborne-only to avoid flooding the
      // 250-cap with parked aircraft and surface vehicles.
      if (!isWatched && onGroundState) continue;
      if (
        s[5] !== null && // longitude
        s[6] !== null && // latitude
        (s[7] !== null || isWatched) && // baro_altitude (ground states report null)
        s[1] !== null && // callsign
        typeof s[1] === "string" &&
        s[1].trim().length > 0
      ) {
        // Velocity can be null on the ground; default to 0 (honest, not mock).
        const vel = s[9] !== null && Number.isFinite(Number(s[9])) ? Math.round(Number(s[9])) : 0;
        filtered.push({
          icao24: icao,
          callsign: String(s[1]).trim(),
          originCountry: String(s[2] || "Commercial"),
          longitude: Number(s[5]),
          latitude: Number(s[6]),
          baroAltitudeMeters: s[7] !== null ? Math.round(Number(s[7])) : 0,
          velocityMps: vel,
          trueTrackDeg: s[10] !== null ? Math.round(Number(s[10])) : 0,
          verticalRateMps: s[11] !== null ? Math.round(Number(s[11]) * 10) / 10 : 0,
          onGround: onGroundState,
        });
        if (filtered.length >= 250) break;
      }
    }
    return filtered;
  } catch {
    return null;
  }
}

/**
 * Fetches 24/7 live commercial aircraft telemetry from global ADS-B receiver network
 * Provides real transponder ADS-B signals with zero rate-limit throttling
 */
async function fetchFromLiveADSB(searchParams: URLSearchParams): Promise<LiveFlightSummary[]> {
  const lat = Math.round(parseFloat(searchParams.get("lat") || "50.1109") * 4) / 4;
  const lon = Math.round(parseFloat(searchParams.get("lon") || "8.6821") * 4) / 4;
  const radius = searchParams.get("radius") || "250";

  const url = `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${radius}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "RouteCO2-Aviation/1.0 (https://github.com/routeco2; flightops@routeco2.internal)",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`ADS-B Network HTTP ${response.status}`);
    }

    const data = await response.json();
    const aircraftList: any[] = data.ac || [];
    const filtered: LiveFlightSummary[] = [];

    for (const a of aircraftList) {
      if (
        a.hex &&
        a.flight &&
        typeof a.flight === "string" &&
        a.flight.trim().length > 0 &&
        typeof a.lat === "number" &&
        typeof a.lon === "number"
      ) {
        const isGround = a.alt_baro === "ground" || a.alt_geom === "ground";
        const altFeet = typeof a.alt_baro === "number" ? a.alt_baro : 0;
        const speedKts = typeof a.gs === "number" ? a.gs : 0;
        const vrateFpm = typeof a.baro_rate === "number" ? a.baro_rate : 0;

        filtered.push({
          icao24: String(a.hex).toLowerCase(),
          callsign: String(a.flight).trim(),
          originCountry: a.r ? String(a.r) : "Commercial",
          equipmentType: a.t ? String(a.t) : "A320",
          longitude: Number(a.lon),
          latitude: Number(a.lat),
          baroAltitudeMeters: Math.round(altFeet * 0.3048),
          velocityMps: Math.round(speedKts * 0.514444),
          trueTrackDeg: typeof a.track === "number" ? Math.round(a.track) : 0,
          verticalRateMps: Math.round(vrateFpm * 0.00508 * 10) / 10,
          onGround: isGround,
        });

        if (filtered.length >= 250) break;
      }
    }

    return filtered;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/** Converts one adsb.lol readsb aircraft object to a LiveFlightSummary (null when unusable). */
function adsbAcToSummary(a: any): LiveFlightSummary | null {
  if (
    !a ||
    !a.hex ||
    !a.flight ||
    typeof a.flight !== "string" ||
    a.flight.trim().length === 0 ||
    typeof a.lat !== "number" ||
    typeof a.lon !== "number"
  ) {
    return null;
  }
  const isGround = a.alt_baro === "ground" || a.alt_geom === "ground";
  const altFeet = typeof a.alt_baro === "number" ? a.alt_baro : 0;
  const speedKts = typeof a.gs === "number" ? a.gs : 0;
  const vrateFpm = typeof a.baro_rate === "number" ? a.baro_rate : 0;
  return {
    icao24: String(a.hex).toLowerCase(),
    callsign: String(a.flight).trim(),
    originCountry: a.r ? String(a.r) : "Commercial",
    equipmentType: a.t ? String(a.t) : "A320",
    longitude: Number(a.lon),
    latitude: Number(a.lat),
    baroAltitudeMeters: Math.round(altFeet * 0.3048),
    velocityMps: Math.round(speedKts * 0.514444),
    trueTrackDeg: typeof a.track === "number" ? Math.round(a.track) : 0,
    verticalRateMps: Math.round(vrateFpm * 0.00508 * 10) / 10,
    onGround: isGround,
  };
}

/**
 * Direct per-aircraft lookup for watched/armed keys (free adsb.lol endpoint).
 * Covers the cross-source gap: OpenSky may drop a landing aircraft that
 * adsb.lol still sees on the ground (or vice versa). Only queried for the
 * caller's explicit watch list — a handful of keys, one cheap call each.
 */
async function fetchWatchedDirect(hexes: string[]): Promise<LiveFlightSummary[]> {
  const out: LiveFlightSummary[] = [];
  if (Date.now() < adsbCooldownUntil) return out;
  await Promise.all(
    hexes.slice(0, 20).map(async (hex) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(`https://api.adsb.lol/v2/icao/${encodeURIComponent(hex)}`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "RouteCO2-Console/1.0 (ETHOnline2026; FlightOperations)",
          },
        });
        clearTimeout(timeoutId);
        if (res.status === 429) {
          adsbCooldownUntil = Date.now() + 120_000;
          console.warn("[adsb.lol] 429 on direct lookup: cooling down 120s");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        const list: any[] = Array.isArray(data.ac) ? data.ac : [];
        for (const a of list) {
          const s = adsbAcToSummary(a);
          if (s) out.push(s);
        }
      } catch {
        clearTimeout(timeoutId);
      }
    })
  );
  return out;
}

export async function GET(request: NextRequest) {
  const now = Date.now();
  const { searchParams } = new URL(request.url);
  const watchHexes = (searchParams.get("watch") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[0-9a-f]{4,6}$/.test(s));

  // The shared cache holds the generic airborne feed. Watch requests bypass
  // the read (a touchdown ground state must never be hidden behind a stale
  // airborne snapshot) but still refresh it when no watch is active.
  if (watchHexes.length === 0 && cachedFlights.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return NextResponse.json({
      flights: cachedFlights,
      count: cachedFlights.length,
      source: lastSource,
      cached: true,
      timestamp: lastFetchTime,
    });
  }

  // 1. Try OpenSky Network with OAuth2 Bearer Auth (includes on-ground
  // states for ?watch= keys so touchdown transitions are observable).
  let flights = await fetchFromOpenSky(searchParams);
  let source = "OpenSky Network ADS-B (OAuth2 Authenticated)";

  // 2. If OpenSky is throttled or empty, fall over to 24/7 live ADS-B receiver feed
  if (!flights || flights.length === 0) {
    try {
      flights = await fetchFromLiveADSB(searchParams);
      source = "Global ADS-B Transponder Network";
    } catch {
      // Fall through to cache or error
    }
  }

  // 3. Cross-source repair for watched keys MISSING from the base feed.
  // OpenSky already includes on-ground states for ?watch= keys, so a present
  // key needs no extra call — this keeps adsb.lol spend near zero in steady
  // state while still catching landings OpenSky drops (coverage gaps).
  if (flights && flights.length > 0 && watchHexes.length > 0) {
    try {
      const have = new Set(flights.map((f) => f.icao24));
      const missing = watchHexes.filter((hex) => !have.has(hex));
      const direct = missing.length > 0 ? await fetchWatchedDirect(missing) : [];
      if (direct.length > 0) {
        const byIcao = new Map(flights.map((f) => [f.icao24, f]));
        for (const d of direct) {
          const cur = byIcao.get(d.icao24);
          if (!cur || (d.onGround && !cur.onGround)) byIcao.set(d.icao24, d);
        }
        flights = [...byIcao.values()];
        source = `${source} + direct watch repair`;
      }
    } catch {
      // Repair is best-effort; the base feed still stands.
    }
  }
  if (flights && flights.length > 0) {
    // Don't let watch-repaired ground states leak into the shared generic
    // cache; the next plain poll refetches its own airborne snapshot anyway.
    if (watchHexes.length === 0) {
      cachedFlights = flights;
      lastFetchTime = now;
      lastSource = source;
    }

    return NextResponse.json({
      flights,
      count: flights.length,
      source,
      cached: false,
      timestamp: now,
    });
  }

  // If both network calls failed, return cached flights if available
  if (cachedFlights.length > 0) {
    return NextResponse.json({
      flights: cachedFlights,
      count: cachedFlights.length,
      source: lastSource,
      cached: true,
      timestamp: lastFetchTime,
    });
  }

  return NextResponse.json(
    { error: "No live ADS-B transponder telemetry acquired from live radar networks" },
    { status: 503 }
  );
}
