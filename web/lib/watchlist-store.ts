"use client";

/**
 * Flight Watchlist recording store (globe watch → land → replay → manual settle).
 *
 * A watched flight accumulates one ADS-B fix per radar poll from the moment the
 * user taps Watch. Recordings persist in localStorage under manual-clear
 * retention: nothing is auto-evicted — the user deletes tracks explicitly.
 * Active watches are delete-protected until stopped.
 */

export interface RecordedFix {
  t: number; // epoch ms
  lat: number;
  lon: number;
  altM: number;
  velMps: number;
  vsiMps: number;
  trackDeg: number;
  onGround: boolean;
}

export interface WatchedFlight {
  key: string; // icao24 lowercase preferred, callsign fallback
  icao24: string;
  callsign: string;
  equipmentType?: string;
  originCountry?: string;
  watchStartedAt: number;
  status: "WATCHING" | "LANDED_RECORDED";
  landedAt?: number;
  fixes: RecordedFix[];
  truncated?: boolean;
}

const STORAGE_KEY = "routeco2_watchlist_recordings_v1";
export const MAX_FIXES_PER_TRACK = 2000;
export const MAX_TRACKS = 50;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Cheap stable hash of a recording for audit binding (FNV-1a, hex). */
export function hashRecording(fixes: RecordedFix[]): string {
  let h = 0x811c9dc5;
  for (const f of fixes) {
    const s = `${f.t},${f.lat.toFixed(4)},${f.lon.toFixed(4)},${Math.round(f.altM)},${f.onGround ? 1 : 0};`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, "0");
}

export function loadWatchedFlights(): WatchedFlight[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (w) => w && typeof w.key === "string" && Array.isArray(w.fixes)
    ) as WatchedFlight[];
  } catch (err) {
    console.warn("[Watchlist] Failed to read recordings:", err);
    return [];
  }
}

function persist(all: WatchedFlight[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("[Watchlist] Persist failed (quota?) — refusing to drop data:", err);
    throw new Error(
      "Recording storage is full. Delete old tracks before watching new flights — nothing was auto-removed."
    );
  }
}

export function saveWatchedFlight(w: WatchedFlight): void {
  const all = loadWatchedFlights().filter((x) => x.key !== w.key);
  all.unshift(w);
  persist(all.slice(0, MAX_TRACKS));
}

export function removeWatchedFlight(key: string): void {
  persist(loadWatchedFlights().filter((x) => x.key !== key));
}

export function clearWatchedFlights(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[Watchlist] Clear failed:", err);
  }
}

/** Observed span in seconds covered by fixes (partial-leg honest metric). */
export function observedSeconds(w: Pick<WatchedFlight, "fixes">): number {
  if (w.fixes.length < 2) return 0;
  return Math.max(0, Math.round((w.fixes[w.fixes.length - 1].t - w.fixes[0].t) / 1000));
}
