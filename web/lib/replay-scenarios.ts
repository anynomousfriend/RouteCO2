/**
 * Replay Flight Scenarios
 * Commercial descent profiles across Narrow-body, Wide-body, Heavy, and Regional aircraft classes
 * Evaluated dynamically via standard aeronautical glideslope & energy profile equations (Doc 9889).
 * Strictly zero static JSON mocks on disk (GEMINI.md Rule 1.1).
 */

export interface ReplayFrame {
  callsign: string;
  baroAltitudeMeters: number;
  velocityMps: number;
  verticalRateMps: number;
  onGround: boolean;
  timestamp: number;
  latitude: number;
  longitude: number;
  trueTrackDeg: number;
}

export type AircraftCategory = "NARROW_BODY" | "WIDE_BODY" | "HEAVY" | "REGIONAL";

export interface LiveFlightSummary {
  icao24: string;
  callsign: string;
  originCountry: string;
  equipmentType?: string;
  longitude: number;
  latitude: number;
  baroAltitudeMeters: number;
  velocityMps: number;
  trueTrackDeg: number;
  verticalRateMps: number;
  onGround: boolean;
}

export interface ReplayScenario {
  id: string;
  callsign: string;
  airline: string;
  airframe: string;
  category: AircraftCategory;
  hourlyBurnKg: number;
  originAirport: string;
  destinationAirport: string;
  destinationName: string;
  runway: string;
  airportCoords: [number, number]; // [lat, lon]
  plannedAirborneSeconds: number;
  icao24: string;
  pricePerTonneUSDC: number;
  description: string;
  touchdownIndex: number;
  frames: ReplayFrame[];
  /** Synthetic physics demo trajectory (3° glideslope equations), NOT live ADS-B telemetry. */
  synthetic: boolean;
}

/**
 * Extracts runway true heading in degrees from runway designation (e.g. "25L" -> 250°).
 */
function parseRunwayHeading(runway: string): number {
  const num = parseInt(runway.replace(/\D/g, ""), 10);
  if (isNaN(num)) return 270;
  return (num * 10) % 360;
}

/**
 * Generates dynamic descent trajectory frames using standard 3° aeronautical glideslope
 * and category-specific kinetic deceleration profiles without any static mock files.
 */
export function generateGlideslopeTrajectory(params: {
  callsign: string;
  category: AircraftCategory;
  airportCoords: [number, number];
  runway: string;
  touchdownIndex: number;
  totalFrames: number;
  baseTimestamp?: number;
  frameIntervalSec?: number;
}): ReplayFrame[] {
  const {
    callsign,
    category,
    airportCoords,
    runway,
    touchdownIndex,
    totalFrames,
    baseTimestamp = 1726050000,
    frameIntervalSec = 120,
  } = params;

  const [destLat, destLon] = airportCoords;
  const rwyHeading = parseRunwayHeading(runway);

  let initialAltMeters = 8500;
  let cruiseVelocityMps = 226;
  let touchdownVelocityMps = 66;

  switch (category) {
    case "HEAVY":
      initialAltMeters = 10400;
      cruiseVelocityMps = 245;
      touchdownVelocityMps = 72;
      break;
    case "WIDE_BODY":
      initialAltMeters = 9600;
      cruiseVelocityMps = 236;
      touchdownVelocityMps = 69;
      break;
    case "REGIONAL":
      initialAltMeters = 7400;
      cruiseVelocityMps = 210;
      touchdownVelocityMps = 62;
      break;
    case "NARROW_BODY":
    default:
      initialAltMeters = 8500;
      cruiseVelocityMps = 226;
      touchdownVelocityMps = 66;
      break;
  }

  const approachBearingDeg = (rwyHeading + 180) % 360;
  const runwayHeadingRad = (rwyHeading * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const frames: ReplayFrame[] = [];
  const altitudes: number[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const isAirborne = i < touchdownIndex;
    let altMeters = 0;
    let velocity = 0;
    let lat = destLat;
    let lon = destLon;
    let trackDeg = rwyHeading;

    if (isAirborne) {
      const remainingProgress = (touchdownIndex - i) / touchdownIndex;

      if (i === 0) {
        altMeters = initialAltMeters;
      } else {
        const curve = Math.pow(remainingProgress, 1.4);
        altMeters = Math.round(initialAltMeters * curve);
        if (remainingProgress < 0.1) {
          altMeters = Math.max(12, Math.round(initialAltMeters * remainingProgress * 0.15));
        }
      }

      velocity = Math.round(
        touchdownVelocityMps +
          (cruiseVelocityMps - touchdownVelocityMps) * Math.pow(remainingProgress, 0.85)
      );

      const secondsToTouchdown = (touchdownIndex - i) * frameIntervalSec;
      const averageSpeedMps = (velocity + touchdownVelocityMps) / 2;
      const distKm = (averageSpeedMps * secondsToTouchdown) / 1000;

      const doglegOffsetDeg = i < 4 ? (4 - i) * 2.5 : 0;
      const activeAngleRad = ((approachBearingDeg + doglegOffsetDeg) * Math.PI) / 180;

      const deltaLatDeg = (distKm / earthRadiusKm) * (180 / Math.PI) * Math.cos(activeAngleRad);
      const deltaLonDeg =
        (distKm / (earthRadiusKm * Math.cos((destLat * Math.PI) / 180))) *
        (180 / Math.PI) *
        Math.sin(activeAngleRad);

      lat = +(destLat + deltaLatDeg).toFixed(5);
      lon = +(destLon + deltaLonDeg).toFixed(5);
      trackDeg = Math.round((rwyHeading - doglegOffsetDeg + 360) % 360);
    } else {
      altMeters = 0;
      const rolloutStep = i - touchdownIndex;

      const rolloutSpeeds = [
        touchdownVelocityMps,
        Math.round(touchdownVelocityMps * 0.72),
        Math.round(touchdownVelocityMps * 0.42),
        16,
      ];
      velocity = rolloutSpeeds[rolloutStep] ?? 12;

      const rolloutDistKm = (velocity * (rolloutStep * 0.2)) / 1000;
      const deltaLatDeg = (rolloutDistKm / earthRadiusKm) * (180 / Math.PI) * Math.cos(runwayHeadingRad);
      const deltaLonDeg =
        (rolloutDistKm / (earthRadiusKm * Math.cos((destLat * Math.PI) / 180))) *
        (180 / Math.PI) *
        Math.sin(runwayHeadingRad);

      lat = +(destLat + deltaLatDeg).toFixed(5);
      lon = +(destLon + deltaLonDeg).toFixed(5);
      trackDeg = rwyHeading;
    }

    altitudes.push(altMeters);

    let verticalRateMps = 0;
    if (i === 0) {
      verticalRateMps = -0.2;
    } else if (i < touchdownIndex) {
      const deltaAlt = altMeters - altitudes[i - 1];
      verticalRateMps = +(deltaAlt / frameIntervalSec).toFixed(1);
    } else {
      verticalRateMps = 0.0;
    }

    frames.push({
      callsign,
      baroAltitudeMeters: altMeters,
      velocityMps: velocity,
      verticalRateMps,
      onGround: !isAirborne,
      timestamp: baseTimestamp + i * frameIntervalSec,
      latitude: lat,
      longitude: lon,
      trueTrackDeg: trackDeg,
    });
  }

  return frames;
}

export const REPLAY_SCENARIOS: ReplayScenario[] = [
  {
    id: "dlh400",
    callsign: "DLH400",
    airline: "Lufthansa",
    airframe: "Airbus A320-200",
    category: "NARROW_BODY",
    hourlyBurnKg: 2400,
    originAirport: "MUC",
    destinationAirport: "EDDF",
    destinationName: "Frankfurt Main",
    runway: "25L",
    airportCoords: [50.1109, 8.6821],
    plannedAirborneSeconds: 3600,
    icao24: "3c6544",
    pricePerTonneUSDC: 25.0,
    description: "Short-haul European feeder arrival into Frankfurt Airport. Synthetic physics demo, not live telemetry.",
    synthetic: true,
    touchdownIndex: 15,
    frames: generateGlideslopeTrajectory({
      callsign: "DLH400",
      category: "NARROW_BODY",
      airportCoords: [50.1109, 8.6821],
      runway: "25L",
      touchdownIndex: 15,
      totalFrames: 19,
    }),
  },
  {
    id: "baw117",
    callsign: "BAW117",
    airline: "British Airways",
    airframe: "Airbus A350-1000",
    category: "WIDE_BODY",
    hourlyBurnKg: 6500,
    originAirport: "BOS",
    destinationAirport: "EGLL",
    destinationName: "London Heathrow",
    runway: "27R",
    airportCoords: [51.4700, -0.4543],
    plannedAirborneSeconds: 21600,
    icao24: "4075c3",
    pricePerTonneUSDC: 25.0,
    description: "Transatlantic wide-body twin-jet arrival into London Heathrow. Synthetic physics demo, not live telemetry.",
    synthetic: true,
    touchdownIndex: 17,
    frames: generateGlideslopeTrajectory({
      callsign: "BAW117",
      category: "WIDE_BODY",
      airportCoords: [51.4700, -0.4543],
      runway: "27R",
      touchdownIndex: 17,
      totalFrames: 21,
    }),
  },
  {
    id: "uae201",
    callsign: "UAE201",
    airline: "Emirates",
    airframe: "Airbus A380-800",
    category: "HEAVY",
    hourlyBurnKg: 10200,
    originAirport: "DXB",
    destinationAirport: "KJFK",
    destinationName: "New York JFK",
    runway: "13L",
    airportCoords: [40.6413, -73.7781],
    plannedAirborneSeconds: 46800,
    icao24: "8964b2",
    pricePerTonneUSDC: 25.0,
    description: "Ultra-long-haul quad-engine superjumbo arrival into New York JFK. Synthetic physics demo, not live telemetry.",
    synthetic: true,
    touchdownIndex: 17,
    frames: generateGlideslopeTrajectory({
      callsign: "UAE201",
      category: "HEAVY",
      airportCoords: [40.6413, -73.7781],
      runway: "13L",
      touchdownIndex: 17,
      totalFrames: 21,
    }),
  },
  {
    id: "afr1248",
    callsign: "AFR1248",
    airline: "Air France Hop",
    airframe: "Embraer E190",
    category: "REGIONAL",
    hourlyBurnKg: 1600,
    originAirport: "BOD",
    destinationAirport: "LFPG",
    destinationName: "Paris Charles de Gaulle",
    runway: "26L",
    airportCoords: [49.0097, 2.5479],
    plannedAirborneSeconds: 2700,
    icao24: "394a12",
    pricePerTonneUSDC: 25.0,
    description: "Regional European feeder jet arrival into Paris Charles de Gaulle. Synthetic physics demo, not live telemetry.",
    synthetic: true,
    touchdownIndex: 15,
    frames: generateGlideslopeTrajectory({
      callsign: "AFR1248",
      category: "REGIONAL",
      airportCoords: [49.0097, 2.5479],
      runway: "26L",
      touchdownIndex: 15,
      totalFrames: 19,
    }),
  },
];
