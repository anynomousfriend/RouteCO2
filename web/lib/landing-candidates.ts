import type { LiveFlightSummary } from "./replay-scenarios";

/**
 * Landing-candidate filter: finds live flights most likely about to land.
 *
 * Pure functions over live ADS-B summaries — no network, no mocks.
 * Criteria (tunable): low barometric altitude + descending vertical rate
 * (smoothed across polls to tame VSI noise) + proximity to a hub with
 * dense ground-receiver coverage. Ranked by ETA ≈ alt / |vsi|.
 */

export interface LandingHub {
  name: string;
  iata: string;
  lat: number;
  lon: number;
}

/** Same hubs as the landed-flights ground network (dense ADS-B coverage). */
export const LANDING_HUBS: LandingHub[] = [
  { name: "Frankfurt Int'l (EDDF)", iata: "FRA", lat: 50.0379, lon: 8.5622 },
  { name: "Paris Charles de Gaulle (LFPG)", iata: "CDG", lat: 49.0097, lon: 2.5479 },
  { name: "London Heathrow (EGLL)", iata: "LHR", lat: 51.47, lon: -0.4543 },
  { name: "Amsterdam Schiphol (EHAM)", iata: "AMS", lat: 52.3105, lon: 4.7683 },
];

/** Tunable gate thresholds. */
export const LANDING_MAX_ALT_M = 3500; // ~11,500 ft: terminal airspace
export const LANDING_FINAL_ALT_M = 1500; // on final: accept level flight (VSI ≈ 0)
export const LANDING_MAX_DESCENT_VSI_MPS = -2.0; // must be descending faster than this…
export const LANDING_MAX_HUB_DIST_KM = 120; // …within this radius of a hub
export const LANDING_MAX_RESULTS = 5;

export interface LandingCandidate {
  flight: LiveFlightSummary;
  hubName: string;
  hubIata: string;
  distKm: number;
  altM: number;
  /** Smoothed vertical rate (avg of recent polls) used for ETA ranking. */
  vsiSmoothedMps: number;
  /** Estimated minutes to touchdown; null when level (final approach). */
  etaMin: number | null;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

/** Mean of recent VSI samples; falls back to the live instantaneous value. */
export function smoothVsi(samples: number[] | undefined, fallback: number): number {
  if (!samples || samples.length === 0) return fallback;
  const xs = samples.slice(-5);
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function nearestHub(lat: number, lon: number): { hub: LandingHub; distKm: number } {
  let best = LANDING_HUBS[0];
  let bestD = haversineKm(lat, lon, best.lat, best.lon);
  for (const h of LANDING_HUBS.slice(1)) {
    const d = haversineKm(lat, lon, h.lat, h.lon);
    if (d < bestD) {
      best = h;
      bestD = d;
    }
  }
  return { hub: best, distKm: bestD };
}

/**
 * Rank live flights by landing likelihood. Returns at most `max` candidates.
 * `vsiByKey` maps (icao24||callsign).toLowerCase() → recent VSI samples for smoothing.
 */
export function rankLandingCandidates(
  flights: LiveFlightSummary[],
  vsiByKey?: Map<string, number[]> | Record<string, number[]>,
  max = LANDING_MAX_RESULTS
): LandingCandidate[] {
  const getSamples = (key: string): number[] | undefined => {
    if (!vsiByKey) return undefined;
    if (vsiByKey instanceof Map) return vsiByKey.get(key);
    return (vsiByKey as Record<string, number[]>)[key];
  };

  const out: LandingCandidate[] = [];
  for (const f of flights) {
    if (f.onGround) continue;
    if (f.latitude == null || f.longitude == null) continue;
    const altM = f.baroAltitudeMeters ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(altM) || altM <= 0 || altM > LANDING_MAX_ALT_M) continue;

    const key = (f.icao24 || f.callsign || "").toLowerCase();
    const vsiSmoothed = smoothVsi(getSamples(key), f.verticalRateMps ?? 0);
    const descending = vsiSmoothed <= LANDING_MAX_DESCENT_VSI_MPS;
    const onFinal = altM <= LANDING_FINAL_ALT_M;
    if (!descending && !onFinal) continue;

    const { hub, distKm } = nearestHub(f.latitude, f.longitude);
    if (distKm > LANDING_MAX_HUB_DIST_KM) continue;

    const etaMin =
      vsiSmoothed < -0.5 ? Math.max(0, altM / Math.abs(vsiSmoothed) / 60) : null;
    out.push({
      flight: f,
      hubName: hub.name,
      hubIata: hub.iata,
      distKm: Math.round(distKm),
      altM: Math.round(altM),
      vsiSmoothedMps: Math.round(vsiSmoothed * 10) / 10,
      etaMin: etaMin == null ? null : Math.round(etaMin),
    });
  }

  out.sort((a, b) => {
    const ea = a.etaMin ?? 45;
    const eb = b.etaMin ?? 45;
    if (ea !== eb) return ea - eb;
    return a.distKm - b.distKm;
  });
  return out.slice(0, max);
}
