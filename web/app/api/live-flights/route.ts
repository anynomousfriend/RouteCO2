import { NextRequest, NextResponse } from "next/server";

export interface LiveFlightSummary {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number;
  latitude: number;
  baroAltitudeMeters: number;
  velocityMps: number;
  trueTrackDeg: number;
  verticalRateMps: number;
  onGround: boolean;
}

// In-memory cache to respect OpenSky rate limits
let cachedFlights: LiveFlightSummary[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds cache

export async function GET(request: NextRequest) {
  const now = Date.now();
  if (cachedFlights.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return NextResponse.json({
      flights: cachedFlights,
      count: cachedFlights.length,
      cached: true,
      timestamp: lastFetchTime,
    });
  }

  const { searchParams } = new URL(request.url);
  const isGlobal = searchParams.get("all") === "true";
  
  // Use bounding box around European/Atlantic commercial flight corridor by default
  // OpenSky global queries transfer 5MB+ and take 20s+, bounding boxes return in <800ms
  const queryUrl = isGlobal
    ? "https://opensky-network.org/api/states/all"
    : `https://opensky-network.org/api/states/all?lamin=${searchParams.get("lamin") || "35"}&lomin=${searchParams.get("lomin") || "-15"}&lamax=${searchParams.get("lamax") || "60"}&lomax=${searchParams.get("lomax") || "30"}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(queryUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "SkyRoute-Console/1.0 (ETHOnline2026; FlightOperations)",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (cachedFlights.length > 0) {
        return NextResponse.json({
          flights: cachedFlights,
          count: cachedFlights.length,
          cached: true,
          timestamp: lastFetchTime,
        });
      }
      return NextResponse.json(
        { error: `OpenSky Network returned status ${response.status}` },
        { status: response.status }
      );
    }

    const data = (await response.json()) as { states: (string | number | boolean | null)[][] };

    if (!data.states || !Array.isArray(data.states)) {
      return NextResponse.json({ flights: cachedFlights, count: cachedFlights.length, cached: true });
    }

    // Filter for active airborne commercial flights with valid coordinates
    const filtered: LiveFlightSummary[] = [];
    for (const s of data.states) {
      if (
        s[8] === false && // on_ground == false
        s[5] !== null &&  // longitude
        s[6] !== null &&  // latitude
        s[7] !== null &&  // baro_altitude
        s[9] !== null &&  // velocity
        s[1] !== null &&  // callsign
        typeof s[1] === "string" &&
        s[1].trim().length > 0
      ) {
        filtered.push({
          icao24: String(s[0]),
          callsign: String(s[1]).trim(),
          originCountry: String(s[2] || "Unknown"),
          longitude: Number(s[5]),
          latitude: Number(s[6]),
          baroAltitudeMeters: Math.round(Number(s[7])),
          velocityMps: Math.round(Number(s[9])),
          trueTrackDeg: s[10] !== null ? Math.round(Number(s[10])) : 0,
          verticalRateMps: s[11] !== null ? Math.round(Number(s[11]) * 10) / 10 : 0,
          onGround: false,
        });

        // Cap to 250 prominent flights for buttery-smooth Leaflet map rendering
        if (filtered.length >= 250) break;
      }
    }

    cachedFlights = filtered;
    lastFetchTime = now;

    return NextResponse.json({
      flights: cachedFlights,
      count: cachedFlights.length,
      cached: false,
      timestamp: lastFetchTime,
    });
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (cachedFlights.length > 0) {
      return NextResponse.json({
        flights: cachedFlights,
        count: cachedFlights.length,
        cached: true,
        timestamp: lastFetchTime,
      });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch live flight telemetry";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
