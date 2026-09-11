import { NextRequest, NextResponse } from "next/server";
import { loadWatches, loadTrack } from "@/lib/server-track-store";

export const dynamic = "force-dynamic";

/**
 * Read side of the sidecar recorder store.
 * - GET /api/server-tracks → metadata list (cheap; poll this).
 * - GET /api/server-tracks?key=<key> → full track with fixes (fetch only
 *   when metadata shows growth or a status flip).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = (searchParams.get("key") || "").trim().toLowerCase();
  const watches = loadWatches();
  if (key) {
    const track = loadTrack(key);
    if (!track) return NextResponse.json({ error: "Unknown track key" }, { status: 404 });
    const watch = watches.find((w) => w.key === key);
    return NextResponse.json({ track: { ...track, auto: watch?.auto ?? track.auto ?? false } });
  }
  const tracks = watches.map((w) => {
    const t = loadTrack(w.key);
    return {
      key: w.key,
      icao24: w.icao24,
      callsign: w.callsign,
      equipmentType: w.equipmentType,
      originCountry: w.originCountry,
      watchStartedAt: w.watchStartedAt,
      status: t?.status ?? w.status,
      landedAt: t?.landedAt ?? w.landedAt,
      fixCount: t?.fixes.length ?? 0,
      truncated: Boolean(t?.truncated),
      auto: Boolean(w.auto),
    };
  });
  return NextResponse.json({ tracks });
}
