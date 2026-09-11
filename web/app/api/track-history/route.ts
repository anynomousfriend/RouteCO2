import { NextRequest, NextResponse } from "next/server";
import { getOpenSkyBearerToken } from "@/lib/opensky-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/track-history?icao24=<hex>
 *
 * Backfills PAST positions for one ongoing flight via OpenSky's free
 * tracks endpoint (no paid key): GET /tracks/all?icao24=<hex>&time=0.
 * Returns waypoints converted to RecordedFix shape so the client can
 * prepend them to a Watch recording — replay then shows the full
 * trajectory, not just the tail observed after Watch.
 *
 * Honest empty results: when OpenSky has no live track (experimental
 * endpoint, coverage gap, landed long ago) we return fixes: [] with a
 * reason — never fabricated telemetry (zero-mock rule).
 */

interface TrackWaypoint {
  t: number;
  lat: number;
  lon: number;
  altM: number;
  velMps: number;
  vsiMps: number;
  trackDeg: number;
  onGround: boolean;
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("icao24") || "").trim().toLowerCase();

  if (!/^[0-9a-f]{4,6}$/.test(raw)) {
    return NextResponse.json(
      { error: "Missing or invalid icao24 (expected 4-6 hex chars)" },
      { status: 400 }
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "RouteCO2-Console/1.0 (ETHOnline2026; FlightOperations)",
  };
  try {
    const token = await getOpenSkyBearerToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch {
    // Unauthenticated attempt still allowed (tighter anonymous quota).
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(
      `https://opensky-network.org/api/tracks/all?icao24=${encodeURIComponent(raw)}&time=0`,
      { signal: controller.signal, headers }
    );
    clearTimeout(timeoutId);

    if (res.status === 404) {
      return NextResponse.json({
        icao24: raw,
        fixes: [],
        source: "OpenSky tracks/all",
        reason: "no-live-track",
        note: "OpenSky has no ongoing track for this aircraft (coverage gap or not airborne in its network). Recording continues live from Watch.",
      });
    }
    if (!res.ok) {
      return NextResponse.json(
        {
          error: `OpenSky tracks upstream HTTP ${res.status}`,
          icao24: raw,
          fixes: [],
          source: "OpenSky tracks/all",
        },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      icao24?: string;
      startTime?: number;
      endTime?: number;
      callsign?: string | null;
      path?: (number | boolean | null)[][];
    };
    const path = Array.isArray(data.path) ? data.path : [];
    // Waypoint: [time(sec), lat, lon, baro_alt(m), track(deg), onGround]
    const fixes: TrackWaypoint[] = [];
    for (const w of path) {
      if (!Array.isArray(w) || w.length < 3) continue;
      const tSec = Number(w[0]);
      const lat = Number(w[1]);
      const lon = Number(w[2]);
      if (!Number.isFinite(tSec) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const altM = w[3] == null ? 0 : Math.round(Number(w[3]));
      const trackDeg = w[4] == null ? 0 : Math.round(Number(w[4]));
      const onGround = w[5] === true;
      fixes.push({
        t: tSec * 1000,
        lat,
        lon,
        altM: Number.isFinite(altM) ? altM : 0,
        velMps: 0,
        vsiMps: 0,
        trackDeg: Number.isFinite(trackDeg) ? trackDeg : 0,
        onGround,
      });
    }
    fixes.sort((a, b) => a.t - b.t);

    // Derive velocity + vertical rate from consecutive waypoints (real math, no mocks).
    for (let i = 1; i < fixes.length; i++) {
      const prev = fixes[i - 1];
      const cur = fixes[i];
      const dtS = (cur.t - prev.t) / 1000;
      if (dtS > 0 && dtS < 3600) {
        cur.velMps = Math.round((haversineM(prev.lat, prev.lon, cur.lat, cur.lon) / dtS) * 10) / 10;
        cur.vsiMps = Math.round(((cur.altM - prev.altM) / dtS) * 10) / 10;
      }
    }

    return NextResponse.json({
      icao24: raw,
      callsign: data.callsign ?? null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      fixes,
      count: fixes.length,
      source: "OpenSky tracks/all (live track, time=0)",
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Track backfill failed: ${msg}`,
        icao24: raw,
        fixes: [],
        source: "OpenSky tracks/all",
      },
      { status: 502 }
    );
  }
}
