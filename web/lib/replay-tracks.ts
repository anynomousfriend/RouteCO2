"use client";

/**
 * Unified playable-track model for the replay console.
 *
 * Sources: "recorded" (user-watched live tracks), "bundled" (canonical
 * pre-recorded live track shipped for deterministic demos), "synthetic"
 * (physics fixtures — hidden behind ?dev-synthetic=1, never in demo paths).
 * PlayableTrack extends the legacy ReplayScenario shape so existing cards
 * (FlightMasterCard) keep working unchanged.
 */

import {
  REPLAY_SCENARIOS,
  type AircraftCategory,
  type ReplayFrame,
  type ReplayScenario,
} from "./replay-scenarios";
import { resolveAirframe } from "./icao-precision";
import type { RecordedFix, WatchedFlight } from "./watchlist-store";

export type TrackSource = "recorded" | "bundled" | "synthetic";

export interface PlayableTrack extends ReplayScenario {
  source: TrackSource;
  capturedAt?: number;
  fixCount?: number;
  observedSeconds?: number;
}

export interface BundledTrackFile {
  callsign: string;
  icao24: string;
  equipmentType?: string;
  originCountry?: string;
  capturedAt: number;
  hub?: string;
  fixes: RecordedFix[];
}

function airframeFor(
  callsign: string,
  equipmentType?: string
): { category: AircraftCategory; hourlyBurnKg: number } {
  const profile = resolveAirframe(equipmentType || null, callsign);
  return { category: profile.category, hourlyBurnKg: profile.baseCruiseBurnKgPerHour };
}

function touchdownIndexOf(frames: ReplayFrame[]): number {
  const idx = frames.findIndex((f, i) => i > 0 && !frames[i - 1].onGround && f.onGround);
  return idx > 0 ? idx : Math.max(0, frames.length - 4);
}

/** Converts recorded ADS-B fixes into playable frames + derived track metadata. */
export function recordedToTrack(
  w: WatchedFlight,
  source: Extract<TrackSource, "recorded" | "bundled">,
  opts: { capturedAt?: number; label?: string } = {}
): PlayableTrack | null {
  if (w.fixes.length < 2) return null;
  const frames: ReplayFrame[] = w.fixes.map((f) => ({
    callsign: w.callsign,
    baroAltitudeMeters: Math.round(f.altM),
    velocityMps: Math.round(f.velMps),
    verticalRateMps: Math.round(f.vsiMps * 10) / 10,
    onGround: f.onGround,
    timestamp: Math.round(f.t / 1000),
    latitude: f.lat,
    longitude: f.lon,
    trueTrackDeg: Math.round(f.trackDeg),
  }));
  const { category, hourlyBurnKg } = airframeFor(w.callsign, w.equipmentType);
  const last = frames[frames.length - 1];
  const observed = Math.max(60, Math.round((w.fixes[w.fixes.length - 1].t - w.fixes[0].t) / 1000));
  const tdIdx = touchdownIndexOf(frames);
  return {
    id: `rec-${w.key}`,
    callsign: w.callsign,
    airline: opts.label || (w.originCountry ? `${w.originCountry} Recorded Track` : "Recorded Live Track"),
    airframe: w.equipmentType || "Recorded ADS-B Track",
    category,
    hourlyBurnKg,
    originAirport: "ENR",
    destinationAirport: "RADAR",
    destinationName: "Recorded live airspace",
    runway: "—",
    airportCoords: [last.latitude, last.longitude],
    plannedAirborneSeconds: observed,
    icao24: w.icao24 || w.callsign.toLowerCase(),
    pricePerTonneUSDC: 25.0,
    description: `Recorded live ADS-B track: ${frames.length} fixes over ${Math.round(observed / 60)} min. Partial-leg observation, not a full flight leg.`,
    touchdownIndex: tdIdx,
    frames,
    synthetic: false,
    source,
    capturedAt: opts.capturedAt ?? w.watchStartedAt,
    fixCount: frames.length,
    observedSeconds: observed,
  };
}

/** Loads the bundled canonical demo track (/demo-track.json); null when absent. */
export async function loadBundledTrack(): Promise<PlayableTrack | null> {
  try {
    const res = await fetch("/demo-track.json", { cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as BundledTrackFile;
    if (!data || !Array.isArray(data.fixes) || data.fixes.length < 2) return null;
    return recordedToTrack(
      {
        key: (data.icao24 || data.callsign).toLowerCase(),
        icao24: (data.icao24 || "").toLowerCase(),
        callsign: String(data.callsign).toUpperCase(),
        equipmentType: data.equipmentType,
        originCountry: data.originCountry,
        watchStartedAt: data.capturedAt || Date.now(),
        status: "LANDED_RECORDED",
        landedAt: data.capturedAt,
        fixes: data.fixes,
      },
      "bundled",
      {
        capturedAt: data.capturedAt,
        label: data.hub ? `Recorded Live Track · ${data.hub}` : "Recorded Live Track · Demo Seed",
      }
    );
  } catch {
    return null;
  }
}

/** Hidden fixture path: synthetic scenarios only with ?dev-synthetic=1. */
export function isSyntheticFixturesEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has("dev-synthetic");
  } catch {
    return false;
  }
}

export function syntheticFixtureTracks(): PlayableTrack[] {
  if (!isSyntheticFixturesEnabled()) return [];
  return REPLAY_SCENARIOS.map((s) => ({ ...s, source: "synthetic" as const }));
}
