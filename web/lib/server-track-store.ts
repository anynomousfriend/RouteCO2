import fs from "node:fs";
import path from "node:path";
import { getOpenSkyBearerToken } from "@/lib/opensky-auth";

/**
 * Server-side watch/track store (used ONLY by API routes, never the client).
 * Backs the sidecar recorder (web/server/watch-recorder.mjs): the client
 * registers Watch intent here, the recorder polls live ADS-B into the same
 * files, and the client merges them back. Atomic tmp+rename writes so the
 * recorder and routes never observe torn JSON.
 */

export interface ServerFix {
  t: number;
  lat: number;
  lon: number;
  altM: number;
  velMps: number;
  vsiMps: number;
  trackDeg: number;
  onGround: boolean;
}

export interface ServerWatch {
  key: string;
  icao24: string;
  callsign: string;
  equipmentType?: string;
  originCountry?: string;
  watchStartedAt: number;
  status: "WATCHING" | "LANDED_RECORDED";
  landedAt?: number;
  misses?: number;
  /** True when the sidecar auto-captured this flight (no UI selection). */
  auto?: boolean;
}

export interface ServerTrack extends ServerWatch {
  fixes: ServerFix[];
  truncated?: boolean;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const TRACKS_DIR = path.join(DATA_DIR, "tracks");
const WATCHES_FILE = path.join(DATA_DIR, "watches.json");
const BUFFER_FILE = path.join(DATA_DIR, "buffer.json");

export const SERVER_TRACK_MAX_FIXES = 2000;

function ensureDirs(): void {
  fs.mkdirSync(TRACKS_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  ensureDirs();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}

export function sanitizeKey(key: string): string {
  return String(key || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32) || "unknown";
}

export function loadWatches(): ServerWatch[] {
  const v = readJson<unknown>(WATCHES_FILE, []);
  return Array.isArray(v) ? (v as ServerWatch[]) : [];
}

export function saveWatches(watches: ServerWatch[]): void {
  writeJsonAtomic(WATCHES_FILE, watches);
}

function trackFile(key: string): string {
  return path.join(TRACKS_DIR, `${sanitizeKey(key)}.json`);
}

export function loadTrack(key: string): ServerTrack | null {
  const v = readJson<ServerTrack | null>(trackFile(key), null);
  return v && Array.isArray(v.fixes) ? v : null;
}

export function saveTrack(track: ServerTrack): void {
  writeJsonAtomic(trackFile(track.key), track);
}

export function deleteTrackFile(key: string): void {
  try {
    fs.unlinkSync(trackFile(key));
  } catch {
    /* already absent */
  }
}

export function loadBufferFixes(key: string): ServerFix[] {
  const snap = readJson<Record<string, ServerFix[]>>(BUFFER_FILE, {});
  const fixes = snap[String(key || "").toLowerCase()];
  return Array.isArray(fixes) ? fixes : [];
}

function isValidFix(f: unknown): f is ServerFix {
  const x = f as ServerFix;
  return (
    !!x &&
    typeof x.t === "number" &&
    typeof x.lat === "number" &&
    typeof x.lon === "number"
  );
}

export function mergeFixes(a: ServerFix[], b: ServerFix[], cap: number): ServerFix[] {
  const seen = new Set<number>();
  const out: ServerFix[] = [];
  for (const f of [...(a || []), ...(b || [])]) {
    if (!isValidFix(f) || seen.has(f.t)) continue;
    seen.add(f.t);
    out.push({
      t: f.t,
      lat: f.lat,
      lon: f.lon,
      altM: f.altM ?? 0,
      velMps: f.velMps ?? 0,
      vsiMps: f.vsiMps ?? 0,
      trackDeg: f.trackDeg ?? 0,
      onGround: Boolean(f.onGround),
    });
  }
  out.sort((x, y) => x.t - y.t);
  return out.length > cap ? out.slice(-cap) : out;
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

/** Free OpenSky live-track backfill (best-effort; [] on gaps — never mocked). */
async function fetchTrackBackfill(icao24: string): Promise<ServerFix[]> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "RouteCO2-Console/1.0 (ETHOnline2026; FlightOperations)",
    };
    const token = await getOpenSkyBearerToken().catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(
      `https://opensky-network.org/api/tracks/all?icao24=${encodeURIComponent(icao24)}&time=0`,
      { signal: ctrl.signal, headers }
    );
    clearTimeout(t);
    if (!res.ok) return [];
    const data = (await res.json()) as { path?: (number | boolean | null)[][] };
    const fixes: ServerFix[] = [];
    for (const w of Array.isArray(data.path) ? data.path : []) {
      if (!Array.isArray(w) || w.length < 3) continue;
      const tSec = Number(w[0]);
      const lat = Number(w[1]);
      const lon = Number(w[2]);
      if (!Number.isFinite(tSec) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      fixes.push({
        t: tSec * 1000,
        lat,
        lon,
        altM: w[3] == null ? 0 : Math.round(Number(w[3])),
        velMps: 0,
        vsiMps: 0,
        trackDeg: w[4] == null ? 0 : Math.round(Number(w[4])),
        onGround: w[5] === true,
      });
    }
    fixes.sort((a, b) => a.t - b.t);
    for (let i = 1; i < fixes.length; i++) {
      const dt = (fixes[i].t - fixes[i - 1].t) / 1000;
      if (dt > 0 && dt < 3600) {
        fixes[i].velMps = Math.round(((haversineM(fixes[i - 1].lat, fixes[i - 1].lon, fixes[i].lat, fixes[i].lon) / dt) * 10)) / 10;
        fixes[i].vsiMps = Math.round(((fixes[i].altM - fixes[i - 1].altM) / dt) * 10) / 10;
      }
    }
    return fixes;
  } catch {
    return [];
  }
}

/**
 * Registers a watch server-side and seeds its track from the recorder's
 * candidate buffer + OpenSky backfill. Idempotent per key.
 */
export async function registerServerWatch(input: {
  key: string;
  icao24: string;
  callsign: string;
  equipmentType?: string;
  originCountry?: string;
}): Promise<{ track: ServerTrack; seeded: number }> {
  const key = sanitizeKey(input.key || input.icao24 || input.callsign);
  const icao24 = (input.icao24 || "").toLowerCase();
  const watches = loadWatches();
  let watch = watches.find((w) => w.key === key);
  if (!watch) {
    watch = {
      key,
      icao24,
      callsign: String(input.callsign || key).toUpperCase(),
      equipmentType: input.equipmentType,
      originCountry: input.originCountry,
      watchStartedAt: Date.now(),
      status: "WATCHING",
    };
    watches.unshift(watch);
    saveWatches(watches.slice(0, 100));
  }
  let track = loadTrack(key);
  if (!track) {
    const buffered = loadBufferFixes(key);
    const past = icao24 ? await fetchTrackBackfill(icao24) : [];
    track = {
      ...watch,
      fixes: mergeFixes(buffered, past, SERVER_TRACK_MAX_FIXES),
    };
    saveTrack(track);
    return { track, seeded: track.fixes.length };
  }
  return { track, seeded: 0 };
}
