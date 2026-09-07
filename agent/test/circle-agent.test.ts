import { describe, it, expect } from "vitest";
import { decodeFunctionData, type Hex, type Address } from "viem";
import {
  arcTestnet,
  SKYROUTE_VAULT_ABI,
  CircleAgentDispatcher,
  type AgentPolicyConfig,
} from "../src/circle-agent.js";
import { calculateWheelsDownEmissions } from "../src/icao-engine.js";

describe("Circle Agent Wallet & Arc Gateway Nanopayment Dispatcher", () => {
  const mockVaultAddress: Address = "0x1111111111111111111111111111111111111111";
  const defaultPolicy: AgentPolicyConfig = {
    vaultAddress: mockVaultAddress,
    maxDailyBudgetUSDC: 500,
    maxPerFlightBudgetUSDC: 100,
    rpcUrl: "https://arc-testnet.drpc.org",
  };

  const sampleFlightId: Hex =
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  describe("1. Arc Testnet Definition", () => {
    it("defines Arc Testnet with Chain ID 5042002 and native USDC gas", () => {
      expect(arcTestnet.id).toBe(5042002);
      expect(arcTestnet.name).toBe("Arc Testnet");
      expect(arcTestnet.nativeCurrency.name).toBe("USDC");
      expect(arcTestnet.nativeCurrency.symbol).toBe("USDC");
      expect(arcTestnet.nativeCurrency.decimals).toBe(6);
      expect(arcTestnet.rpcUrls.default.http[0]).toBe("https://arc-testnet.drpc.org");
      expect(arcTestnet.blockExplorers?.default.url).toBe("https://testnet.arcscan.app");
    });
  });

  describe("2. Agent Policy Enforcement", () => {
    it("encodes settlement when flight cost is within budget cap", () => {
      const dispatcher = new CircleAgentDispatcher(defaultPolicy);
      const settlement = calculateWheelsDownEmissions(1800, "NARROW_BODY", 25.0);
      expect(settlement.costUSDC).toBeLessThanOrEqual(defaultPolicy.maxPerFlightBudgetUSDC);

      const calldata = dispatcher.encodeSettlement(sampleFlightId, settlement);
      expect(calldata).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("throws descriptive error when flight cost exceeds maxPerFlightBudgetUSDC", () => {
      const dispatcher = new CircleAgentDispatcher({
        ...defaultPolicy,
        maxPerFlightBudgetUSDC: 50, // lower cap to trigger violation
      });

      const settlement = calculateWheelsDownEmissions(3600, "NARROW_BODY", 25.0);
      expect(settlement.costUSDC).toBeGreaterThan(50);

      expect(() => {
        dispatcher.encodeSettlement(sampleFlightId, settlement);
      }).toThrow(/budget policy/i);
    });
  });

  describe("3. Calldata Encoding & ABI Conformance", () => {
    it("encodes settleWheelsDown calldata matching ABI exactly", () => {
      const dispatcher = new CircleAgentDispatcher({
        ...defaultPolicy,
        maxPerFlightBudgetUSDC: 500,
      });

      const settlement = calculateWheelsDownEmissions(7200, "NARROW_BODY", 25.0);
      const calldata = dispatcher.encodeSettlement(sampleFlightId, settlement);

      const decoded = decodeFunctionData({
        abi: SKYROUTE_VAULT_ABI,
        data: calldata,
      });

      expect(decoded.functionName).toBe("settleWheelsDown");
      expect(decoded.args[0]).toBe(sampleFlightId);
      expect(decoded.args[1]).toBe(BigInt(Math.floor(settlement.airborneSeconds)));
      expect(decoded.args[2]).toBe(BigInt(Math.floor(settlement.fuelBurnKg)));
      expect(decoded.args[3]).toBe(BigInt(Math.floor(settlement.co2Kg)));
      expect(decoded.args[4]).toBe(settlement.usdcAmountMicro);
    });

    it("prepares a full settlement transaction payload for Arc Testnet broadcast", () => {
      const dispatcher = new CircleAgentDispatcher({
        ...defaultPolicy,
        maxPerFlightBudgetUSDC: 500,
      });

      const settlement = calculateWheelsDownEmissions(3600, "REGIONAL", 25.0);
      const tx = dispatcher.prepareSettlementTransaction(sampleFlightId, settlement);

      expect(tx.to).toBe(mockVaultAddress);
      expect(tx.chainId).toBe(5042002);
      expect(tx.data).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(tx.settlement).toEqual(settlement);
    });
  });

  describe("4. Live Arc Testnet RPC Connectivity (Zero-Mock Verification)", () => {
    it("queries real block number from live Arc Testnet RPC (blockNumber > 0n)", async () => {
      const dispatcher = new CircleAgentDispatcher(defaultPolicy);
      const blockNumber = await dispatcher.getLiveArcBlockNumber();

      expect(typeof blockNumber).toBe("bigint");
      expect(blockNumber).toBeGreaterThan(0n);
    }, 15000);
  });
});
