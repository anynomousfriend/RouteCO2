import { describe, it, expect } from "vitest";
import {
  ICAO_CARBON_FACTOR,
  ICAO_AIRCRAFT_BENCHMARKS,
  calculateWheelsDownEmissions,
  detectFlightPhase,
  calculateInstantaneousFuelBurn,
  calculateSegmentEmissions,
  calculateOffsetCostUSDC,
  parseOpenSkyState,
  type FlightTelemetry,
  type OpenSkyStateVector,
  type AircraftCategory,
  type WheelsDownSettlementResult,
} from "../src/icao-engine.js";

describe("ICAO Fuel Burn & Emissions Engine", () => {
  describe("1. Standards & Constants", () => {
    it("strictly adheres to ICAO Doc 9889 Jet-A1 carbon emission factor (3.16 kg CO2/kg fuel)", () => {
      expect(ICAO_CARBON_FACTOR).toBe(3.16);
    });
  });

  describe("2. Flight Phase Detection", () => {
    it("detects GROUND phase when aircraft is flagged on ground or altitude is below 100m", () => {
      const taxi: FlightTelemetry = {
        callsign: "UAL101",
        baroAltitudeMeters: 45,
        velocityMps: 12,
        verticalRateMps: 0,
        onGround: true,
      };
      expect(detectFlightPhase(taxi)).toBe("GROUND");
    });

    it("detects CLIMB phase when climbing with vertical rate > 2.5 m/s (~500 ft/min)", () => {
      const climb: FlightTelemetry = {
        callsign: "DLH400",
        baroAltitudeMeters: 3500,
        velocityMps: 180,
        verticalRateMps: 9.2,
        onGround: false,
      };
      expect(detectFlightPhase(climb)).toBe("CLIMB");
    });

    it("detects CRUISE phase at high altitude (>= 7000m / FL230+) with low vertical rate", () => {
      const cruise: FlightTelemetry = {
        callsign: "AFR006",
        baroAltitudeMeters: 11200,
        velocityMps: 245,
        verticalRateMps: 0.1,
        onGround: false,
      };
      expect(detectFlightPhase(cruise)).toBe("CRUISE");
    });

    it("detects DESCENT phase when descending with vertical rate < -2.5 m/s", () => {
      const descent: FlightTelemetry = {
        callsign: "BAW178",
        baroAltitudeMeters: 4500,
        velocityMps: 195,
        verticalRateMps: -7.5,
        onGround: false,
      };
      expect(detectFlightPhase(descent)).toBe("DESCENT");
    });

    it("detects LEVEL_FLIGHT at intermediate altitudes (< 7000m) with low vertical rate", () => {
      const hold: FlightTelemetry = {
        callsign: "SWA210",
        baroAltitudeMeters: 3000,
        velocityMps: 150,
        verticalRateMps: 0.0,
        onGround: false,
      };
      expect(detectFlightPhase(hold)).toBe("LEVEL_FLIGHT");
    });
  });

  describe("3. Instantaneous Fuel Burn Dynamics", () => {
    it("scales fuel burn during climb thrust compared to cruise", () => {
      const cruise: FlightTelemetry = {
        callsign: "TEST01",
        baroAltitudeMeters: 10500,
        velocityMps: 240,
        verticalRateMps: 0,
        onGround: false,
      };
      const climb: FlightTelemetry = {
        callsign: "TEST01",
        baroAltitudeMeters: 4000,
        velocityMps: 200,
        verticalRateMps: 10.0,
        onGround: false,
      };

      const cruiseBurn = calculateInstantaneousFuelBurn(cruise);
      const climbBurn = calculateInstantaneousFuelBurn(climb);

      expect(climbBurn.fuelBurnRateKgPerSec).toBeGreaterThan(cruiseBurn.fuelBurnRateKgPerSec);
      expect(climbBurn.burnMultiplier).toBeGreaterThan(1.2);
    });

    it("applies cruise altitude efficiency discount for high altitudes versus low altitudes", () => {
      const lowLevel: FlightTelemetry = {
        callsign: "TEST02",
        baroAltitudeMeters: 2000,
        velocityMps: 220,
        verticalRateMps: 0,
        onGround: false,
      };
      const highCruise: FlightTelemetry = {
        callsign: "TEST02",
        baroAltitudeMeters: 11500,
        velocityMps: 220,
        verticalRateMps: 0,
        onGround: false,
      };

      const lowBurn = calculateInstantaneousFuelBurn(lowLevel);
      const highBurn = calculateInstantaneousFuelBurn(highCruise);

      expect(highBurn.fuelBurnRateKgPerSec).toBeLessThan(lowBurn.fuelBurnRateKgPerSec);
    });

    it("reduces fuel burn during descent idle compared to cruise", () => {
      const cruise: FlightTelemetry = {
        callsign: "TEST03",
        baroAltitudeMeters: 10000,
        velocityMps: 230,
        verticalRateMps: 0,
        onGround: false,
      };
      const descent: FlightTelemetry = {
        callsign: "TEST03",
        baroAltitudeMeters: 5000,
        velocityMps: 200,
        verticalRateMps: -8.0,
        onGround: false,
      };

      const cruiseBurn = calculateInstantaneousFuelBurn(cruise);
      const descentBurn = calculateInstantaneousFuelBurn(descent);

      expect(descentBurn.fuelBurnRateKgPerSec).toBeLessThan(cruiseBurn.fuelBurnRateKgPerSec);
      expect(descentBurn.burnMultiplier).toBeLessThan(0.6);
    });
  });

  describe("4. Waypoint Segment Emissions & USDC Offset Cost", () => {
    it("calculates emissions over a waypoint segment duration", () => {
      const cruise: FlightTelemetry = {
        callsign: "VIR10",
        baroAltitudeMeters: 11000,
        velocityMps: 240,
        verticalRateMps: 0,
        onGround: false,
      };
      const durationSeconds = 120; // 2-minute waypoint leg
      const result = calculateSegmentEmissions(cruise, durationSeconds);

      expect(result.durationSeconds).toBe(120);
      expect(result.fuelBurnKg).toBeCloseTo(result.fuelBurnRateKgPerSec * 120, 3);
      expect(result.carbonEmittedKg).toBeCloseTo(result.fuelBurnKg * 3.16, 3);
    });

    it("calculates 6-decimal micro-USDC offset cost for Arc Testnet settlement", () => {
      const carbonKg = 1000; // Exactly 1 metric tonne of CO2
      const pricePerTonneUSDC = 25.0; // $25 per tonne
      const microUsdc = calculateOffsetCostUSDC(carbonKg, pricePerTonneUSDC);

      // 1 tonne * $25 = $25 USDC = 25,000,000 micro-USDC
      expect(microUsdc).toBe(25000000n);
    });
  });

  describe("5. Wheels-Down Duration & Aircraft Category Benchmarks", () => {
    it("defines published ICAO category fuel-burn benchmarks", () => {
      expect(ICAO_AIRCRAFT_BENCHMARKS.NARROW_BODY).toEqual({
        label: "Narrow-body (A320 / B737)",
        hourlyBurnKg: 2400,
      });
      expect(ICAO_AIRCRAFT_BENCHMARKS.WIDE_BODY).toEqual({
        label: "Wide-body (A350 / B777)",
        hourlyBurnKg: 6500,
      });
      expect(ICAO_AIRCRAFT_BENCHMARKS.REGIONAL).toEqual({
        label: "Regional Jet (E190 / CRJ900)",
        hourlyBurnKg: 1600,
      });
      expect(ICAO_AIRCRAFT_BENCHMARKS.HEAVY).toEqual({
        label: "Heavy (A380 / B747)",
        hourlyBurnKg: 10200,
      });
    });

    it("calculates wheels-down emissions for 2 hours (7200s) on NARROW_BODY at $25/tonne", () => {
      const result: WheelsDownSettlementResult = calculateWheelsDownEmissions(
        7200,
        "NARROW_BODY",
        25.0
      );

      expect(result.airborneSeconds).toBe(7200);
      expect(result.aircraftCategory).toBe("NARROW_BODY");
      expect(result.hourlyBurnKg).toBe(2400);
      expect(result.fuelBurnKg).toBe(4800);
      expect(result.co2Kg).toBe(15168);
      expect(result.pricePerTonneUSDC).toBe(25.0);
      expect(result.costUSDC).toBeCloseTo(379.2, 4);
      expect(result.usdcAmountMicro).toBe(379200000n);
    });

    it("applies default category (NARROW_BODY) and default price ($25.0/tonne) if omitted", () => {
      const result = calculateWheelsDownEmissions(3600); // 1 hour

      expect(result.aircraftCategory).toBe("NARROW_BODY");
      expect(result.hourlyBurnKg).toBe(2400);
      expect(result.fuelBurnKg).toBe(2400);
      expect(result.co2Kg).toBe(7584);
      expect(result.pricePerTonneUSDC).toBe(25.0);
      expect(result.costUSDC).toBeCloseTo(189.6, 4);
      expect(result.usdcAmountMicro).toBe(189600000n);
    });

    it("calculates emissions correctly for WIDE_BODY category", () => {
      const result = calculateWheelsDownEmissions(3600, "WIDE_BODY", 20.0);

      expect(result.aircraftCategory).toBe("WIDE_BODY");
      expect(result.hourlyBurnKg).toBe(6500);
      expect(result.fuelBurnKg).toBe(6500);
      expect(result.co2Kg).toBe(20540); // 6500 * 3.16
      expect(result.costUSDC).toBeCloseTo(410.8, 4);
      expect(result.usdcAmountMicro).toBe(410800000n);
    });

    it("handles zero and negative airborne durations safely", () => {
      const zeroResult = calculateWheelsDownEmissions(0);
      expect(zeroResult.fuelBurnKg).toBe(0);
      expect(zeroResult.co2Kg).toBe(0);
      expect(zeroResult.costUSDC).toBe(0);
      expect(zeroResult.usdcAmountMicro).toBe(0n);

      const negResult = calculateWheelsDownEmissions(-500);
      expect(negResult.fuelBurnKg).toBe(0);
      expect(negResult.co2Kg).toBe(0);
      expect(negResult.costUSDC).toBe(0);
      expect(negResult.usdcAmountMicro).toBe(0n);
    });
  });

  describe("6. Live OpenSky Network Ingestion (Zero-Mock Verification)", () => {
    it("ingests live ADS-B flight vectors from OpenSky and computes emissions", async () => {
      const response = await fetch("https://opensky-network.org/api/states/all");
      expect(response.ok).toBe(true);

      const data = (await response.json()) as { states: OpenSkyStateVector[] };
      expect(Array.isArray(data.states)).toBe(true);
      expect(data.states.length).toBeGreaterThan(0);

      // Find an airborne flight with complete telemetry
      const activeState = data.states.find(
        (s) => s[8] === false && s[7] !== null && s[9] !== null && s[11] !== null && s[1]?.trim().length > 0
      );

      expect(activeState).toBeDefined();
      if (!activeState) return;

      const telemetry = parseOpenSkyState(activeState);
      expect(telemetry.callsign.length).toBeGreaterThan(0);
      expect(telemetry.onGround).toBe(false);
      expect(telemetry.baroAltitudeMeters).toBeGreaterThan(0);

      const burn = calculateInstantaneousFuelBurn(telemetry);
      expect(burn.fuelBurnRateKgPerSec).toBeGreaterThan(0);
      expect(burn.phase).not.toBe("GROUND");

      const emissions = calculateSegmentEmissions(telemetry, 60);
      expect(emissions.carbonEmittedKg).toBeGreaterThan(0);

      const offsetCost = calculateOffsetCostUSDC(emissions.carbonEmittedKg, 25.0);
      expect(offsetCost).toBeGreaterThan(0n);
    }, 20000);
  });
});
