import { describe, it, expect, beforeEach } from "vitest";
import { type Address, type Hex } from "viem";
import {
  CircleAgentWallet,
  createCircleAgentWallet,
  type CircleAgentWalletConfig,
} from "../src/circle-wallet.js";

describe("Circle Agent Wallet & Policy Guards (AGENT.md Track 2)", () => {
  const samplePrivateKey: Hex =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  // Address corresponding to samplePrivateKey (Foundry dev #0)
  const expectedAddress: Address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const sampleVault: Address = "0x469CA8E59ae25CBEEC2eA52617163E2396B9bdA1";
  const unauthorizedVault: Address = "0x9999999999999999999999999999999999999999";

  let wallet: CircleAgentWallet;

  beforeEach(() => {
    wallet = new CircleAgentWallet({
      privateKey: samplePrivateKey,
      allowedContracts: [sampleVault],
      maxDailyBudgetUSDC: 500,
      maxPerFlightBudgetUSDC: 100,
    });
  });

  describe("1. Credential Management & Address Resolution", () => {
    it("derives correct agent address from private key", () => {
      expect(wallet.getAddress().toLowerCase()).toBe(expectedAddress.toLowerCase());
      expect(wallet.getAccount()?.address.toLowerCase()).toBe(expectedAddress.toLowerCase());
    });

    it("accepts explicit wallet address when private key is not directly provided", () => {
      const pubOnlyWallet = new CircleAgentWallet({
        address: expectedAddress,
        allowedContracts: [sampleVault],
      });
      expect(pubOnlyWallet.getAddress()).toBe(expectedAddress);
      expect(pubOnlyWallet.getAccount()).toBeUndefined();
    });

    it("fails loudly when no credentials or address can be resolved", () => {
      expect(() => {
        new CircleAgentWallet({
          privateKey: undefined,
          address: undefined,
        });
      }).toThrow(/Circle Agent wallet credentials missing/i);
    });
  });

  describe("2. Contract Allowlist Policy Verification", () => {
    it("allows transactions to allowlisted SkyRouteVault address", () => {
      expect(wallet.isContractAllowed(sampleVault)).toBe(true);
      expect(() => wallet.assertContractAllowed(sampleVault)).not.toThrow();
    });

    it("rejects transactions to unwhitelisted target contracts", () => {
      expect(wallet.isContractAllowed(unauthorizedVault)).toBe(false);
      expect(() => wallet.assertContractAllowed(unauthorizedVault)).toThrow(
        /Unauthorized target contract/i
      );
    });

    it("allows adding new contracts to allowlist dynamically", () => {
      const newContract: Address = "0x1234567890123456789012345678901234567890";
      expect(wallet.isContractAllowed(newContract)).toBe(false);
      wallet.addAllowedContract(newContract);
      expect(wallet.isContractAllowed(newContract)).toBe(true);
    });
  });

  describe("3. Spending Limit Policy Guards", () => {
    it("validates spend within per-flight and daily limits", () => {
      expect(() => wallet.validateSpend(50)).not.toThrow();
    });

    it("throws error when single flight offset exceeds maxPerFlightBudgetUSDC", () => {
      expect(() => wallet.validateSpend(150)).toThrow(/per-flight budget cap/i);
    });

    it("tracks cumulative spend and enforces daily budget cap", () => {
      wallet.recordSpend(80);
      expect(wallet.getDailySpend()).toBe(80);
      expect(wallet.getRemainingDailyBudget()).toBe(420);

      // Another 80 is under 100 per flight, total would be 160 (under 500)
      wallet.recordSpend(80);
      expect(wallet.getDailySpend()).toBe(160);

      // Try to record 400 (per-flight 400 > 100) -> throws per-flight
      expect(() => wallet.validateSpend(400)).toThrow(/per-flight budget cap/i);
    });

    it("throws error when cumulative spend exceeds maxDailyBudgetUSDC", () => {
      // 5 flights of 90 USDC = 450
      wallet.recordSpend(90);
      wallet.recordSpend(90);
      wallet.recordSpend(90);
      wallet.recordSpend(90);
      wallet.recordSpend(90); // total 450, remaining 50

      // Attempt 60 USDC (per-flight 60 < 100, but 450 + 60 = 510 > 500)
      expect(() => wallet.validateSpend(60)).toThrow(/daily budget cap/i);
    });

    it("resets daily spend on demand", () => {
      wallet.recordSpend(90);
      expect(wallet.getDailySpend()).toBe(90);
      wallet.resetDailySpend();
      expect(wallet.getDailySpend()).toBe(0);
      expect(wallet.getRemainingDailyBudget()).toBe(500);
    });
  });

  describe("4. Factory Function", () => {
    it("creates CircleAgentWallet instance via createCircleAgentWallet helper", () => {
      const instance = createCircleAgentWallet({
        privateKey: samplePrivateKey,
        allowedContracts: [sampleVault],
      });
      expect(instance).toBeInstanceOf(CircleAgentWallet);
      expect(instance.getAddress().toLowerCase()).toBe(expectedAddress.toLowerCase());
    });
  });
});
