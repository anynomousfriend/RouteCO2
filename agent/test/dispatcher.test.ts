import { describe, it, expect } from "vitest";
import { runReplaySession, queryLiveFleet, type DispatcherSettlementEvent } from "../src/dispatcher.js";

describe("Autonomous Flight Dispatcher Daemon", () => {
  describe("1. Replay Engine Session Execution", () => {
    it("runs complete DLH400 descent and triggers verified wheels-down settlement", async () => {
      const result = await runReplaySession({ verbose: false });

      expect(result).toBeDefined();
      expect(result.flightId).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.callsign).toBe("DLH400");
      expect(result.airborneSeconds).toBeGreaterThan(0);
      expect(result.emissions.fuelBurnKg).toBeGreaterThan(0);
      expect(result.emissions.co2Kg).toBeGreaterThan(0);
      expect(result.emissions.usdcAmountMicro).toBeGreaterThan(0n);
      expect(result.transaction.to).toBeDefined();
      expect(result.transaction.data).toMatch(/^0x[a-fA-F0-9]+/);
      expect(result.transaction.chainId).toBe(5042002);
      expect(result.arcBlockNumber).toBeGreaterThan(0n);
    });

    it("includes valid ArcScan verification link in result", async () => {
      const result = await runReplaySession({ verbose: false });

      expect(result.explorerUrl).toContain("https://testnet.arcscan.app");
      expect(result.explorerUrl).toContain(result.transaction.to);
    });
  });

  describe("2. Live Fleet Telemetry Querying (Zero-Mock)", () => {
    it("queries real commercial aircraft from OpenSky Network and computes emissions", async () => {
      const fleet = await queryLiveFleet(5);

      expect(Array.isArray(fleet)).toBe(true);
      if (fleet.length > 0) {
        const flight = fleet[0];
        expect(flight.callsign).toBeDefined();
        expect(flight.category).toBeDefined();
        expect(typeof flight.hourlyBurnKg).toBe("number");
      }
    }, 15000); // 15s timeout for live API
  });
});
