/**
 * Replay Flight Scenarios
 * Commercial descent profiles across Narrow-body, Wide-body, and Heavy aircraft classes
 * Used in Replay Demo mode to demonstrate ICAO Doc 9889 fuel burn scaling and 1inch Aqua settlements.
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

export interface ReplayScenario {
  id: string;
  callsign: string;
  airline: string;
  airframe: string;
  category: "NARROW_BODY" | "WIDE_BODY" | "HEAVY";
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
    description: "Short-haul European feeder arrival into Frankfurt Airport.",
    touchdownIndex: 16,
    frames: [
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 8000,
    "velocityMps": 220,
    "verticalRateMps": -12,
    "onGround": false,
    "timestamp": 1716000000,
    "latitude": 50.32,
    "longitude": 9.45,
    "trueTrackDeg": 248.5
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 6800,
    "velocityMps": 215,
    "verticalRateMps": -10.5,
    "onGround": false,
    "timestamp": 1716000600,
    "latitude": 50.29,
    "longitude": 9.3,
    "trueTrackDeg": 249
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 5600,
    "velocityMps": 205,
    "verticalRateMps": -9.5,
    "onGround": false,
    "timestamp": 1716001200,
    "latitude": 50.25,
    "longitude": 9.15,
    "trueTrackDeg": 249.2
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 4500,
    "velocityMps": 195,
    "verticalRateMps": -8.5,
    "onGround": false,
    "timestamp": 1716001800,
    "latitude": 50.21,
    "longitude": 9,
    "trueTrackDeg": 249.5
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 3500,
    "velocityMps": 180,
    "verticalRateMps": -7.5,
    "onGround": false,
    "timestamp": 1716002200,
    "latitude": 50.17,
    "longitude": 8.87,
    "trueTrackDeg": 250
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 2500,
    "velocityMps": 165,
    "verticalRateMps": -6.5,
    "onGround": false,
    "timestamp": 1716002600,
    "latitude": 50.13,
    "longitude": 8.76,
    "trueTrackDeg": 250.2
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 1800,
    "velocityMps": 150,
    "verticalRateMps": -5.5,
    "onGround": false,
    "timestamp": 1716002900,
    "latitude": 50.1,
    "longitude": 8.69,
    "trueTrackDeg": 250.5
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 1200,
    "velocityMps": 135,
    "verticalRateMps": -4.8,
    "onGround": false,
    "timestamp": 1716003150,
    "latitude": 50.08,
    "longitude": 8.64,
    "trueTrackDeg": 250.5
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 800,
    "velocityMps": 115,
    "verticalRateMps": -4.2,
    "onGround": false,
    "timestamp": 1716003300,
    "latitude": 50.065,
    "longitude": 8.61,
    "trueTrackDeg": 250.8
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 500,
    "velocityMps": 98,
    "verticalRateMps": -3.8,
    "onGround": false,
    "timestamp": 1716003400,
    "latitude": 50.052,
    "longitude": 8.592,
    "trueTrackDeg": 251
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 300,
    "velocityMps": 85,
    "verticalRateMps": -3.5,
    "onGround": false,
    "timestamp": 1716003480,
    "latitude": 50.045,
    "longitude": 8.582,
    "trueTrackDeg": 251
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 150,
    "velocityMps": 76,
    "verticalRateMps": -3.2,
    "onGround": false,
    "timestamp": 1716003530,
    "latitude": 50.04,
    "longitude": 8.576,
    "trueTrackDeg": 251
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 80,
    "velocityMps": 72,
    "verticalRateMps": -2.5,
    "onGround": false,
    "timestamp": 1716003560,
    "latitude": 50.037,
    "longitude": 8.573,
    "trueTrackDeg": 251
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 50,
    "velocityMps": 70,
    "verticalRateMps": -2,
    "onGround": false,
    "timestamp": 1716003580,
    "latitude": 50.035,
    "longitude": 8.572,
    "trueTrackDeg": 251
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 25,
    "velocityMps": 69,
    "verticalRateMps": -1.2,
    "onGround": false,
    "timestamp": 1716003590,
    "latitude": 50.034,
    "longitude": 8.571,
    "trueTrackDeg": 251
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 10,
    "velocityMps": 68.5,
    "verticalRateMps": -0.8,
    "onGround": false,
    "timestamp": 1716003596,
    "latitude": 50.0335,
    "longitude": 8.5707,
    "trueTrackDeg": 251
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 8,
    "velocityMps": 68,
    "verticalRateMps": -0.5,
    "onGround": true,
    "timestamp": 1716003600,
    "latitude": 50.0333,
    "longitude": 8.5705,
    "trueTrackDeg": 251
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 8,
    "velocityMps": 55,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716003610,
    "latitude": 50.0325,
    "longitude": 8.567,
    "trueTrackDeg": 251
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 8,
    "velocityMps": 40,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716003620,
    "latitude": 50.0318,
    "longitude": 8.5635,
    "trueTrackDeg": 251
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 8,
    "velocityMps": 26,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716003630,
    "latitude": 50.0312,
    "longitude": 8.5605,
    "trueTrackDeg": 251
  },
  {
    "callsign": "DLH400",
    "baroAltitudeMeters": 8,
    "velocityMps": 15,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716003640,
    "latitude": 50.0308,
    "longitude": 8.558,
    "trueTrackDeg": 251
  }
]
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
    plannedAirborneSeconds: 9000,
    icao24: "4075c3",
    pricePerTonneUSDC: 25.0,
    description: "Transatlantic wide-body twin-jet arrival into London Heathrow.",
    touchdownIndex: 16,
    frames: [
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 9212,
    "velocityMps": 240,
    "verticalRateMps": -11.5,
    "onGround": false,
    "timestamp": 1716010000,
    "latitude": 51.65,
    "longitude": 0.85,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 8417,
    "velocityMps": 229,
    "verticalRateMps": -11,
    "onGround": false,
    "timestamp": 1716010200,
    "latitude": 51.6465,
    "longitude": 0.7687,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 7643,
    "velocityMps": 219,
    "verticalRateMps": -10.5,
    "onGround": false,
    "timestamp": 1716010400,
    "latitude": 51.6418,
    "longitude": 0.6875,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 6891,
    "velocityMps": 208,
    "verticalRateMps": -10,
    "onGround": false,
    "timestamp": 1716010600,
    "latitude": 51.6349,
    "longitude": 0.6062,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 6162,
    "velocityMps": 198,
    "verticalRateMps": -9.5,
    "onGround": false,
    "timestamp": 1716010800,
    "latitude": 51.625,
    "longitude": 0.525,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 5457,
    "velocityMps": 187,
    "verticalRateMps": -9,
    "onGround": false,
    "timestamp": 1716011000,
    "latitude": 51.6119,
    "longitude": 0.4437,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 4777,
    "velocityMps": 176,
    "verticalRateMps": -8.5,
    "onGround": false,
    "timestamp": 1716011200,
    "latitude": 51.596,
    "longitude": 0.3625,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 4123,
    "velocityMps": 166,
    "verticalRateMps": -8,
    "onGround": false,
    "timestamp": 1716011400,
    "latitude": 51.5779,
    "longitude": 0.2813,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 3498,
    "velocityMps": 155,
    "verticalRateMps": -7.5,
    "onGround": false,
    "timestamp": 1716011600,
    "latitude": 51.5588,
    "longitude": 0.2,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 2904,
    "velocityMps": 144,
    "verticalRateMps": -7,
    "onGround": false,
    "timestamp": 1716011800,
    "latitude": 51.5399,
    "longitude": 0.1187,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 2342,
    "velocityMps": 134,
    "verticalRateMps": -6.5,
    "onGround": false,
    "timestamp": 1716012000,
    "latitude": 51.5224,
    "longitude": 0.0375,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 1817,
    "velocityMps": 123,
    "verticalRateMps": -6,
    "onGround": false,
    "timestamp": 1716012200,
    "latitude": 51.5072,
    "longitude": -0.0438,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 1333,
    "velocityMps": 113,
    "verticalRateMps": -5.5,
    "onGround": false,
    "timestamp": 1716012400,
    "latitude": 51.4951,
    "longitude": -0.125,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 895,
    "velocityMps": 102,
    "verticalRateMps": -5,
    "onGround": false,
    "timestamp": 1716012600,
    "latitude": 51.4861,
    "longitude": -0.2063,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 513,
    "velocityMps": 91,
    "verticalRateMps": -4.5,
    "onGround": false,
    "timestamp": 1716012800,
    "latitude": 51.4799,
    "longitude": -0.2875,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 202,
    "velocityMps": 81,
    "verticalRateMps": -4,
    "onGround": false,
    "timestamp": 1716013000,
    "latitude": 51.4757,
    "longitude": -0.3688,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 10,
    "velocityMps": 70,
    "verticalRateMps": -0.5,
    "onGround": false,
    "timestamp": 1716013200,
    "latitude": 51.4723,
    "longitude": -0.45,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 8,
    "velocityMps": 69,
    "verticalRateMps": -0.5,
    "onGround": true,
    "timestamp": 1716013400,
    "latitude": 51.47,
    "longitude": -0.4543,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 0,
    "velocityMps": 56,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716013600,
    "latitude": 51.4688,
    "longitude": -0.4605,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 0,
    "velocityMps": 43,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716013800,
    "latitude": 51.4675,
    "longitude": -0.4668,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 0,
    "velocityMps": 29,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716014000,
    "latitude": 51.4663,
    "longitude": -0.473,
    "trueTrackDeg": 271.5
  },
  {
    "callsign": "BAW117",
    "baroAltitudeMeters": 0,
    "velocityMps": 16,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716014200,
    "latitude": 51.465,
    "longitude": -0.4793,
    "trueTrackDeg": 271.5
  }
]
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
    plannedAirborneSeconds: 21600,
    icao24: "8964b2",
    pricePerTonneUSDC: 25.0,
    description: "Ultra-long-haul quad-engine superjumbo arrival into New York JFK.",
    touchdownIndex: 16,
    frames: [
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 10515,
    "velocityMps": 260,
    "verticalRateMps": -13,
    "onGround": false,
    "timestamp": 1716020000,
    "latitude": 41.15,
    "longitude": -73.2,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 9639,
    "velocityMps": 248,
    "verticalRateMps": -12.5,
    "onGround": false,
    "timestamp": 1716020350,
    "latitude": 41.1182,
    "longitude": -73.2361,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 8783,
    "velocityMps": 237,
    "verticalRateMps": -11.9,
    "onGround": false,
    "timestamp": 1716020700,
    "latitude": 41.0864,
    "longitude": -73.2723,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 7948,
    "velocityMps": 225,
    "verticalRateMps": -11.4,
    "onGround": false,
    "timestamp": 1716021050,
    "latitude": 41.0546,
    "longitude": -73.3084,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 7136,
    "velocityMps": 213,
    "verticalRateMps": -10.9,
    "onGround": false,
    "timestamp": 1716021400,
    "latitude": 41.0228,
    "longitude": -73.3445,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 6347,
    "velocityMps": 201,
    "verticalRateMps": -10.4,
    "onGround": false,
    "timestamp": 1716021750,
    "latitude": 40.991,
    "longitude": -73.3807,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 5582,
    "velocityMps": 190,
    "verticalRateMps": -9.8,
    "onGround": false,
    "timestamp": 1716022100,
    "latitude": 40.9592,
    "longitude": -73.4168,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 4844,
    "velocityMps": 178,
    "verticalRateMps": -9.3,
    "onGround": false,
    "timestamp": 1716022450,
    "latitude": 40.9274,
    "longitude": -73.4529,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 4134,
    "velocityMps": 166,
    "verticalRateMps": -8.8,
    "onGround": false,
    "timestamp": 1716022800,
    "latitude": 40.8956,
    "longitude": -73.4891,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 3455,
    "velocityMps": 154,
    "verticalRateMps": -8.2,
    "onGround": false,
    "timestamp": 1716023150,
    "latitude": 40.8639,
    "longitude": -73.5252,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 2808,
    "velocityMps": 143,
    "verticalRateMps": -7.7,
    "onGround": false,
    "timestamp": 1716023500,
    "latitude": 40.8321,
    "longitude": -73.5613,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 2199,
    "velocityMps": 131,
    "verticalRateMps": -7.2,
    "onGround": false,
    "timestamp": 1716023850,
    "latitude": 40.8003,
    "longitude": -73.5974,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 1631,
    "velocityMps": 119,
    "verticalRateMps": -6.7,
    "onGround": false,
    "timestamp": 1716024200,
    "latitude": 40.7685,
    "longitude": -73.6336,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 1111,
    "velocityMps": 107,
    "verticalRateMps": -6.1,
    "onGround": false,
    "timestamp": 1716024550,
    "latitude": 40.7367,
    "longitude": -73.6697,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 649,
    "velocityMps": 96,
    "verticalRateMps": -5.6,
    "onGround": false,
    "timestamp": 1716024900,
    "latitude": 40.7049,
    "longitude": -73.7058,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 264,
    "velocityMps": 84,
    "verticalRateMps": -5.1,
    "onGround": false,
    "timestamp": 1716025250,
    "latitude": 40.6731,
    "longitude": -73.742,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 12,
    "velocityMps": 72,
    "verticalRateMps": -0.6,
    "onGround": false,
    "timestamp": 1716025600,
    "latitude": 40.6413,
    "longitude": -73.7781,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 9,
    "velocityMps": 71,
    "verticalRateMps": -0.6,
    "onGround": true,
    "timestamp": 1716025950,
    "latitude": 40.6413,
    "longitude": -73.7781,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 0,
    "velocityMps": 57,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716026300,
    "latitude": 40.6376,
    "longitude": -73.7743,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 0,
    "velocityMps": 44,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716026650,
    "latitude": 40.6338,
    "longitude": -73.7706,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 0,
    "velocityMps": 30,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716027000,
    "latitude": 40.6301,
    "longitude": -73.7668,
    "trueTrackDeg": 134
  },
  {
    "callsign": "UAE201",
    "baroAltitudeMeters": 0,
    "velocityMps": 16,
    "verticalRateMps": 0,
    "onGround": true,
    "timestamp": 1716027350,
    "latitude": 40.6263,
    "longitude": -73.7631,
    "trueTrackDeg": 134
  }
]
  }
];
