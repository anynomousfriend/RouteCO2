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

/**
 * Fetches live ADS-B telemetry from OpenSky Network (with OAuth2 Bearer Auth or Basic Auth)
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(queryUrl, {
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[OpenSky API] Query returned status ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { states: (string | number | boolean | null)[][] };
    if (!data.states || !Array.isArray(data.states)) {
      return null;
    }

    const filtered: LiveFlightSummary[] = [];
    for (const s of data.states) {
      if (
        s[8] === false && // airborne
        s[5] !== null &&  // longitude
        s[6] !== null &&  // latitude
        s[7] !== null &&  // baro_altitude
        s[9] !== null &&  // velocity
        s[1] !== null &&  // callsign
        typeof s[1] === "string" &&
        s[1].trim().length > 0
      ) {
        filtered.push({
          icao24: String(s[0]).toLowerCase(),
          callsign: String(s[1]).trim(),
          originCountry: String(s[2] || "Commercial"),
          longitude: Number(s[5]),
          latitude: Number(s[6]),
          baroAltitudeMeters: Math.round(Number(s[7])),
          velocityMps: Math.round(Number(s[9])),
          trueTrackDeg: s[10] !== null ? Math.round(Number(s[10])) : 0,
          verticalRateMps: s[11] !== null ? Math.round(Number(s[11]) * 10) / 10 : 0,
          onGround: false,
        });
        if (filtered.length >= 250) break;
      }
    }
    return filtered;
  } catch {
    clearTimeout(timeoutId);
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

export async function GET(request: NextRequest) {
  const now = Date.now();
  if (cachedFlights.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return NextResponse.json({
      flights: cachedFlights,
      count: cachedFlights.length,
      source: lastSource,
      cached: true,
      timestamp: lastFetchTime,
    });
  }

  const { searchParams } = new URL(request.url);

  // 1. Try OpenSky Network with OAuth2 Bearer Auth
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

  if (flights && flights.length > 0) {
    cachedFlights = flights;
    lastFetchTime = now;
    lastSource = source;

    return NextResponse.json({
      flights: cachedFlights,
      count: cachedFlights.length,
      source: lastSource,
      cached: false,
      timestamp: lastFetchTime,
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
