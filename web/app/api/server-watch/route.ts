import { NextRequest, NextResponse } from "next/server";
import {
  loadWatches,
  saveWatches,
  registerServerWatch,
  deleteTrackFile,
} from "@/lib/server-track-store";

export const dynamic = "force-dynamic";

/**
 * Watch registry for the sidecar recorder (web/server/watch-recorder.mjs).
 * - GET: list the server watch manifest.
 * - POST {icao24, callsign, equipmentType?, originCountry?}: register a watch
 *   (idempotent) and seed its track from buffer + OpenSky backfill.
 * - DELETE ?key=... (&delete=1 to also drop the stored track file).
 */
export async function GET() {
  return NextResponse.json({ watches: loadWatches() });
}

export async function POST(request: NextRequest) {
  let body: { key?: string; icao24?: string; callsign?: string; equipmentType?: string; originCountry?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const icao24 = String(body.icao24 || "").trim().toLowerCase();
  const callsign = String(body.callsign || "").trim();
  const key = String(body.key || icao24 || callsign).trim().toLowerCase();
  if (!key || (!/^[0-9a-f]{4,6}$/.test(icao24) && callsign.length < 3)) {
    return NextResponse.json(
      { error: "Provide icao24 (4-6 hex) or a callsign (>=3 chars)" },
      { status: 400 }
    );
  }
  try {
    const { track, seeded } = await registerServerWatch({
      key,
      icao24,
      callsign,
      equipmentType: body.equipmentType,
      originCountry: body.originCountry,
    });
    return NextResponse.json({
      ok: true,
      key: track.key,
      status: track.status,
      fixCount: track.fixes.length,
      seeded,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server watch failed: ${msg}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = (searchParams.get("key") || "").trim().toLowerCase();
  if (!key) return NextResponse.json({ error: "Missing ?key=" }, { status: 400 });
  saveWatches(loadWatches().filter((w) => w.key !== key));
  if (searchParams.get("delete") === "1") deleteTrackFile(key);
  return NextResponse.json({ ok: true, key });
}
