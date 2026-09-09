import { describe, it, expect } from "vitest";
import { decodeFunctionData, type Hex, type Address } from "viem";
import {
  ArcSettler,
  registerFlightManifestOnArc,
  settleWheelsDownOnArc,
  SKYROUTE_VAULT_FULL_ABI,
} from "../src/arc-settler.js";
import { CircleAgentWallet } from "../src/circle-wallet.js";
import { compileSwapVMCurve } from "../src/swapvm-compiler.js";

describe("Arc Testnet On-Chain Settler (Chain ID 5042002)", () => {
  const samplePrivateKey: Hex =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const sampleVault: Address = "0xb579e26C81FDf858a9A6a0F3CcAB497a70343c5d";
  const sampleTreasury: Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const sampleFlightId: Hex =
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  describe("1. Calldata Encoding & ABI Conformance", () => {
    it("encodes registerFlightManifest calldata with SwapVM bytecode", () => {
      const wallet = new CircleAgentWallet({
        privateKey: samplePrivateKey,
        allowedContracts: [sampleVault],
      });
      const settler = new ArcSettler({
        wallet,
        vaultAddress: sampleVault,
      });

      const swapVmBytecode = compileSwapVMCurve();
      const maxBudget = 500_000_000n; // 500 USDC (6 decimals)
      const data = settler.encodeRegisterManifest(
        "DLH400",
        "NARROW_BODY",
        sampleTreasury,
        maxBudget,
        swapVmBytecode
      );

      expect(data).toMatch(/^0x[a-fA-F0-9]+$/);
      const decoded = decodeFunctionData({
        abi: SKYROUTE_VAULT_FULL_ABI,
        data,
      });

      expect(decoded.functionName).toBe("registerFlightManifest");
      expect(decoded.args[0]).toBe("DLH400");
      expect(decoded.args[1]).toBe("NARROW_BODY");
      expect((decoded.args[2] as string).toLowerCase()).toBe(sampleTreasury.toLowerCase());
      expect(decoded.args[3]).toBe(maxBudget);
      expect(decoded.args[4]).toBe(swapVmBytecode);
    });

    it("encodes settleWheelsDown calldata matching ISkyRouteVault specification", () => {
      const wallet = new CircleAgentWallet({
        privateKey: samplePrivateKey,
        allowedContracts: [sampleVault],
      });
      const settler = new ArcSettler({
        wallet,
        vaultAddress: sampleVault,
      });

      const data = settler.encodeSettleWheelsDown(
        sampleFlightId,
        3600n,
        2400n,
        7584n,
        189_600_000n // $189.60 USDC
      );

      expect(data).toMatch(/^0x[a-fA-F0-9]+$/);
      const decoded = decodeFunctionData({
        abi: SKYROUTE_VAULT_FULL_ABI,
        data,
      });

      expect(decoded.functionName).toBe("settleWheelsDown");
      expect(decoded.args[0]).toBe(sampleFlightId);
      expect(decoded.args[1]).toBe(3600n);
      expect(decoded.args[2]).toBe(2400n);
      expect(decoded.args[3]).toBe(7584n);
      expect(decoded.args[4]).toBe(189_600_000n);
    });
  });

  describe("2. Policy Guard Enforcement in Broadcaster", () => {
    it("rejects settlement execution if target vault is not allowlisted", () => {
      const unauthorizedVault: Address = "0x8888888888888888888888888888888888888888";
      const wallet = new CircleAgentWallet({
        privateKey: samplePrivateKey,
        allowedContracts: [sampleVault],
      });

      expect(() => {
        new ArcSettler({
          wallet,
          vaultAddress: unauthorizedVault,
        });
      }).toThrow(/Unauthorized target contract/i);
    });

    it("rejects settlement if payment amount exceeds per-flight budget limit", () => {
      const wallet = new CircleAgentWallet({
        privateKey: samplePrivateKey,
        allowedContracts: [sampleVault],
        maxPerFlightBudgetUSDC: 100, // $100 cap
      });
      const settler = new ArcSettler({
        wallet,
        vaultAddress: sampleVault,
      });

      expect(() => {
        settler.encodeSettleWheelsDown(
          sampleFlightId,
          3600n,
          2400n,
          7584n,
          150_000_000n // $150 > $100 cap
        );
      }).toThrow(/per-flight budget cap/i);
    });
  });

  describe("3. Live Arc Testnet RPC & Explorer Integration (Zero-Mock)", () => {
    it("connects to live Arc Testnet RPC and checks chain ID 5042002", async () => {
      const wallet = new CircleAgentWallet({
        privateKey: samplePrivateKey,
        allowedContracts: [sampleVault],
      });
      const settler = new ArcSettler({
        wallet,
        vaultAddress: sampleVault,
      });

      const chainId = await settler.getChainId();
      expect(chainId).toBe(5042002);

      const blockNumber = await settler.getBlockNumber();
      expect(blockNumber).toBeGreaterThan(0n);
    }, 15000);

    it("formats proper ArcScan explorer URL for transactions", () => {
      const wallet = new CircleAgentWallet({
        privateKey: samplePrivateKey,
        allowedContracts: [sampleVault],
      });
      const settler = new ArcSettler({
        wallet,
        vaultAddress: sampleVault,
      });

      const sampleTxHash: Hex = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const url = settler.getExplorerTxUrl(sampleTxHash);
      expect(url).toBe(`https://testnet.arcscan.app/tx/${sampleTxHash}`);
    });
  });
});
