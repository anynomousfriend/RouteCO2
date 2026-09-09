import { NextRequest, NextResponse } from "next/server";
import {
  resolveAirframe,
  calculateLandedFlightSettlement,
  AirframeProfile,
  LandedFlightSettlementEstimate,
} from "@/lib/icao-precision";

export const dynamic = "force-dynamic";

export interface LiveLandedFlightRecord {
  id: string;
  callsign: string;
  icao24: string;
  operator: string;
  origin: string;
  destination: string;
  airframe: AirframeProfile;
  landedAt: string;
  airborneSeconds: number;
  distanceKm: number;
  estimate: LandedFlightSettlementEstimate;
  status: "PENDING" | "SETTLING" | "SETTLED";
  txHash?: string;
  settledAt?: string;
  explorerUrl?: string;
  groundTelemetry?: {
    groundSpeedKts: number;
    latitude: number;
    longitude: number;
    registration?: string;
  };
}

// Major global airport hubs with high-density ADS-B ground receiver coverage
const AIRPORT_HUBS = [
  { name: "Frankfurt Int'l (EDDF)", iata: "FRA", lat: 50.0379, lon: 8.5622, city: "Frankfurt" },
  { name: "Paris Charles de Gaulle (LFPG)", iata: "CDG", lat: 49.0097, lon: 2.5479, city: "Paris" },
  { name: "London Heathrow (EGLL)", iata: "LHR", lat: 51.4700, lon: -0.4543, city: "London" },
  { name: "Amsterdam Schiphol (EHAM)", iata: "AMS", lat: 52.3105, lon: 4.7683, city: "Amsterdam" },
];

const OPERATOR_NAMES: Record<string, string> = {
  DLH: "Lufthansa German Airlines",
  AFR: "Air France",
  BAW: "British Airways",
  KLM: "KLM Royal Dutch Airlines",
  SVA: "Saudia",
  TAM: "LATAM Airlines",
  UAE: "Emirates",
  QTR: "Qatar Airways",
  SIA: "Singapore Airlines",
  UAL: "United Airlines",
  AAL: "American Airlines",
  DAL: "Delta Air Lines",
  RYR: "Ryanair",
  EZY: "easyJet",
  THY: "Turkish Airlines",
  SAS: "Scandinavian Airlines",
  IBE: "Iberia",
  FIN: "Finnair",
  TAP: "TAP Air Portugal",
  SWR: "Swiss International Air Lines",
  AUA: "Austrian Airlines",
  WZZ: "Wizz Air",
  GWI: "Eurowings",
  EWG: "Eurowings",
  OCN: "Discover Airlines",
  AIH: "Air Incheon",
  CLX: "Cargolux",
};

// In-memory cache to prevent public API rate limits
let cachedLanded: LiveLandedFlightRecord[] = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 15000; // 15s cache

export async function GET(request: NextRequest) {
  const now = Date.now();
  if (cachedLanded.length > 0 && now - lastCacheTime < CACHE_TTL_MS) {
    return NextResponse.json({
      flights: cachedLanded,
      count: cachedLanded.length,
      cached: true,
      timestamp: lastCacheTime,
      source: "ADS-B Ground Transponder Network",
    });
  }

  const results: LiveLandedFlightRecord[] = [];
  const seenIcao = new Set<string>();

  // Fetch surface traffic across major airport hubs concurrently
  const fetchPromises = AIRPORT_HUBS.map(async (hub) => {
    try {
      const url = `https://api.adsb.lol/v2/lat/${hub.lat}/lon/${hub.lon}/dist/25`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "RouteCO2-FlightOps/1.0",
        },
        next: { revalidate: 15 },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.ac || []).map((ac: any) => ({ ...ac, detectedAtHub: hub }));
    } catch {
      return [];
    }
  });

  const rawTrafficByHub = await Promise.all(fetchPromises);
  const allRawAircraft = rawTrafficByHub.flat();

  for (const ac of allRawAircraft) {
    if (!ac.hex || !ac.flight) continue;
    const callsign = String(ac.flight).trim().toUpperCase();
    const hex = String(ac.hex).toLowerCase();

    // Exclude ground vehicles, tugs, test beacons, and towers
    if (
      callsign.length < 3 ||
      callsign.startsWith("TWR") ||
      callsign.startsWith("GND") ||
      callsign.startsWith("CAR") ||
      callsign.startsWith("FIRE") ||
      callsign.startsWith("FOLLOW") ||
      callsign.startsWith("REF") ||
      callsign.startsWith("Z")
    ) {
      continue;
    }

    // Verify wheels-down state: transponder reports ground or low taxi speed on surface
    const isGround = ac.alt_baro === "ground" || ac.alt_geom === "ground";
    const isLowAndSlow = typeof ac.alt_baro === "number" && ac.alt_baro < 400 && (ac.gs ?? 0) < 45;
    if (!isGround && !isLowAndSlow) continue;

    if (seenIcao.has(hex)) continue;
    seenIcao.add(hex);

    const operatorPrefix = callsign.slice(0, 3);
    const operator = OPERATOR_NAMES[operatorPrefix] || (ac.r ? `Registration ${ac.r}` : "Commercial Air Transport");
    const typeCode = ac.t ? String(ac.t).toUpperCase() : null;
    const airframe = resolveAirframe(typeCode, callsign);

    // Differentiate typical short-haul vs long-haul flights based on category
    let airborneSeconds = 5400; // default 1.5h
    let distanceKm = 750;
    let origin = "Regional / European Sector";

    if (airframe.category === "WIDE_BODY") {
      airborneSeconds = 25200; // 7h
      distanceKm = 5800;
      origin = "Transatlantic / Intercontinental";
    } else if (airframe.category === "HEAVY") {
      airborneSeconds = 36000; // 10h
      distanceKm = 8500;
      origin = "Long-Haul Transoceanic";
    } else if (airframe.category === "REGIONAL") {
      airborneSeconds = 3600; // 1h
      distanceKm = 450;
      origin = "Domestic Feeder Route";
    }

    const estimate = calculateLandedFlightSettlement({
      callsign,
      icao24: hex,
      airframe,
      airborneSeconds,
      distanceKm,
    });

    const speedKts = typeof ac.gs === "number" ? Math.round(ac.gs) : 0;
    const landedStatusDesc =
      speedKts === 0
        ? "Parked at Gate (Engines Off)"
        : `Taxiing to Gate (${speedKts} kts Ground Speed)`;

    results.push({
      id: `live-landed-${hex}-${callsign.toLowerCase()}`,
      callsign,
      icao24: hex,
      operator,
      origin,
      destination: ac.detectedAtHub.name,
      airframe,
      landedAt: landedStatusDesc,
      airborneSeconds,
      distanceKm,
      estimate: {
        ...estimate,
        usdcAmountMicro: estimate.usdcAmountMicro.toString(),
      },
      status: "PENDING",
      groundTelemetry: {
        groundSpeedKts: speedKts,
        latitude: Number(ac.lat || ac.detectedAtHub.lat),
        longitude: Number(ac.lon || ac.detectedAtHub.lon),
        registration: ac.r ? String(ac.r) : undefined,
      },
    });

    if (results.length >= 10) break;
  }

  if (results.length > 0) {
    cachedLanded = results;
    lastCacheTime = now;
  }

  return NextResponse.json({
    flights: results.length > 0 ? results : cachedLanded,
    count: results.length > 0 ? results.length : cachedLanded.length,
    timestamp: now,
    source: "ADS-B Ground Transponder Network",
  });
}
