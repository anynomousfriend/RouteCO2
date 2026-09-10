"use client";

import type { LandedFlightRecord } from "@/components/LandedSettlementQueue";

const STORAGE_KEY_SETTLED = "routeco2_settled_landed_flights";

/**
 * Retrieve all previously settled landed flights from persistent localStorage.
 */
export function getStoredSettledFlights(): LandedFlightRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTLED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((f) => f && f.status === "SETTLED");
  } catch (err) {
    console.warn("[SettledStorage] Failed to read settled flights:", err);
    return [];
  }
}

/**
 * Persist a single settled flight into localStorage.
 */
export function saveStoredSettledFlight(flight: LandedFlightRecord): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredSettledFlights();
    // Match by ID, callsign, or icao24
    const filtered = current.filter(
      (f) =>
        f.id !== flight.id &&
        f.callsign.toUpperCase() !== flight.callsign.toUpperCase() &&
        (!flight.icao24 || f.icao24.toLowerCase() !== flight.icao24.toLowerCase())
    );
    const updated = [{ ...flight, status: "SETTLED" as const }, ...filtered];
    localStorage.setItem(STORAGE_KEY_SETTLED, JSON.stringify(updated));
  } catch (err) {
    console.warn("[SettledStorage] Failed to persist flight:", err);
  }
}

/**
 * Merge live ADS-B radar arrivals with persisted settled flights.
 * Guarantees that previously settled flights retain their SETTLED status, txHash, and receipt,
 * and offline settled flights stay in the queue until cleared.
 */
export function mergeWithStoredSettled(liveFlights: LandedFlightRecord[]): LandedFlightRecord[] {
  const settled = getStoredSettledFlights();
  if (settled.length === 0) return liveFlights;

  const settledById = new Map<string, LandedFlightRecord>();
  const settledByCallsign = new Map<string, LandedFlightRecord>();
  const settledByIcao = new Map<string, LandedFlightRecord>();

  settled.forEach((f) => {
    settledById.set(f.id, f);
    settledByCallsign.set(f.callsign.toUpperCase(), f);
    if (f.icao24) settledByIcao.set(f.icao24.toLowerCase(), f);
  });

  // Map live flights: replace pending with settled if already in storage
  const mergedLive = liveFlights.map((live) => {
    const match =
      settledById.get(live.id) ||
      settledByCallsign.get(live.callsign.toUpperCase()) ||
      (live.icao24 ? settledByIcao.get(live.icao24.toLowerCase()) : undefined);

    return match || live;
  });

  // Retain any stored settled flights that are no longer actively on tarmac
  const liveIds = new Set(mergedLive.map((f) => f.id));
  const liveCallsigns = new Set(mergedLive.map((f) => f.callsign.toUpperCase()));

  const offlineSettled = settled.filter(
    (s) => !liveIds.has(s.id) && !liveCallsigns.has(s.callsign.toUpperCase())
  );

  return [...mergedLive, ...offlineSettled];
}
