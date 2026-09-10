/**
 * Circle Agent Wallet & Arc Gateway Nanopayment Dispatcher
 *
 * Implements autonomous flight dispatcher logic on Arc Testnet (Chain ID 5042002).
 * Validates spending policies, encodes zero-custody Aqua settleWheelsDown calls,
 * and prepares native USDC micropayment transactions to SkyRouteVault on Arc.
 */

import {
  defineChain,
  createPublicClient,
  http,
  encodeFunctionData,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import type { WheelsDownSettlementResult } from "./icao-engine.js";

/**
 * Arc Testnet Chain Definition (Chain ID 5042002)
 * Native currency: USDC (6 decimals)
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network", "https://arc-testnet.drpc.org"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

/**
 * Minimal ABI for SkyRouteVault settlement and manifest inspection
 * (matches contracts/src/interfaces/ISkyRouteVault.sol; manifests returns
 * callsign, aircraftCategory, treasury, maxBudgetUSDC, swapVmBytecode, strategyHash, settled)
 */
export const SKYROUTE_VAULT_ABI = [
  {
    type: "function",
    name: "settleWheelsDown",
    inputs: [
      { name: "flightId", type: "bytes32" },
      { name: "airborneSeconds", type: "uint256" },
      { name: "fuelBurnKg", type: "uint256" },
      { name: "co2Kg", type: "uint256" },
      { name: "usdcAmount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "manifests",
    inputs: [{ name: "flightId", type: "bytes32" }],
    outputs: [
      { name: "callsign", type: "string" },
      { name: "aircraftCategory", type: "string" },
      { name: "treasury", type: "address" },
      { name: "maxBudgetUSDC", type: "uint256" },
      { name: "swapVmBytecode", type: "bytes" },
      { name: "strategyHash", type: "bytes32" },
      { name: "settled", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

export interface AgentPolicyConfig {
  vaultAddress: Address;
  maxDailyBudgetUSDC: number;
  maxPerFlightBudgetUSDC: number;
  rpcUrl?: string;
}

export interface PreparedSettlementTransaction {
  to: Address;
  data: Hex;
  chainId: number;
  settlement: WheelsDownSettlementResult;
}

/**
 * Autonomous Flight Dispatcher executing bounded nanopayments on Arc Testnet
 */
export class CircleAgentDispatcher {
  public readonly config: Required<AgentPolicyConfig>;
  public readonly publicClient: PublicClient;

  constructor(config: AgentPolicyConfig) {
    this.config = {
      vaultAddress: config.vaultAddress,
      maxDailyBudgetUSDC: config.maxDailyBudgetUSDC,
      maxPerFlightBudgetUSDC: config.maxPerFlightBudgetUSDC,
      rpcUrl: config.rpcUrl ?? "https://rpc.testnet.arc.network",
    };

    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(this.config.rpcUrl),
    });
  }

  /**
   * Validates policy bounds and encodes calldata for settleWheelsDown
   * @throws Error if settlement cost violates maxPerFlightBudgetUSDC
   */
  encodeSettlement(flightId: Hex, settlement: WheelsDownSettlementResult): Hex {
    if (settlement.costUSDC > this.config.maxPerFlightBudgetUSDC) {
      throw new Error(
        `Budget policy violation: flight offset cost ${settlement.costUSDC.toFixed(
          2
        )} USDC exceeds max per-flight budget cap of ${this.config.maxPerFlightBudgetUSDC.toFixed(
          2
        )} USDC`
      );
    }

    return encodeFunctionData({
      abi: SKYROUTE_VAULT_ABI,
      functionName: "settleWheelsDown",
      args: [
        flightId,
        BigInt(Math.floor(settlement.airborneSeconds)),
        BigInt(Math.floor(settlement.fuelBurnKg)),
        BigInt(Math.floor(settlement.co2Kg)),
        settlement.usdcAmountMicro,
      ],
    });
  }

  /**
   * Queries real block number from live Arc Testnet RPC (Zero-Mock)
   */
  async getLiveArcBlockNumber(): Promise<bigint> {
    return await this.publicClient.getBlockNumber();
  }

  /**
   * Prepares complete transaction payload for Arc Testnet settlement
   */
  prepareSettlementTransaction(
    flightId: Hex,
    settlement: WheelsDownSettlementResult
  ): PreparedSettlementTransaction {
    const data = this.encodeSettlement(flightId, settlement);
    return {
      to: this.config.vaultAddress,
      data,
      chainId: arcTestnet.id,
      settlement,
    };
  }
}
