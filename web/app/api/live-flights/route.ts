import { NextResponse } from "next/server";

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

export async function GET() {
  const now = Date.now();
  if (cachedFlights.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return NextResponse.json({
      flights: cachedFlights,
      count: cachedFlights.length,
      cached: true,
      timestamp: lastFetchTime,
    });
  }

  try {
    const response = await fetch("https://opensky-network.org/api/states/all", {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 15 },
    });

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
        { error: `OpenSky API returned status ${response.status}` },
        { status: response.status }
      );
    }

    const data = (await response.json()) as { states: (string | number | boolean | null)[][] };

    if (!data.states || !Array.isArray(data.states)) {
      return NextResponse.json({ flights: cachedFlights });
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
    const message = error instanceof Error ? error.message : "Failed to fetch live flight telemetry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
