"use client";

/**
 * Bring-Your-Own-Key (BYOK) client-side settler for production self-testing.
 *
 * The visitor pastes a TESTNET private key which lives ONLY in browser memory
 * (React state/ref: never persisted, never logged, never sent to any server).
 * All four settlement steps are signed locally with viem and broadcast straight
 * to the public Arc RPC: register → approve → ship → settle. The server is not
 * involved at all, so no server-side secrets are needed on production.
 *
 * TESTNET ONLY: nothing here prevents mainnet use technically; the UI must
 * gate this behind explicit testnet warnings. Never paste a key holding real funds.
 */

import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  http,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  arcTestnet,
  publicArcClient,
  SKYROUTE_VAULT_ABI,
} from "./arc-client";

const AQUA_SHIP_ABI = [
  {
    type: "function",
    name: "ship",
    inputs: [
      { name: "app", type: "address" },
      { name: "strategy", type: "bytes" },
      { name: "tokens", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [{ name: "strategyHash", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export interface ByokSettlementParams {
  callsign: string;
  aircraftCategory: string;
  airborneSeconds: number;
  fuelBurnKg: number;
  co2Kg: number;
  usdcAmountMicro: bigint;
  swapVmBytecode: Hex;
  vaultAddress: Address;
  aquaAddress: Address;
  usdcAddress: Address;
  rpcUrl?: string;
}

export interface ByokStep {
  step: "register" | "approve" | "ship" | "settle" | "verify";
  txHash?: Hash;
}

export interface ByokSettlementResult {
  flightId: Hex;
  registerTxHash: Hash;
  settleTxHash: Hash;
  blockNumber: number;
  gasUsed: string;
  explorerUrl: string;
  agentAddress: Address;
  treasuryAddress: Address;
  totalCarbonOffsetKg: string;
}

/** Validates pasted input and derives the address without storing anything. */
export function deriveByokAddress(input: string): Address {
  const key = normalizeByokKey(input);
  return privateKeyToAccount(key).address;
}

export function normalizeByokKey(input: string): Hex {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a private key.");
  const hex = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("Invalid private key format: expected 32-byte hex (64 characters).");
  }
  return hex as Hex;
}

export async function runByokSettlement(
  privateKey: Hex,
  p: ByokSettlementParams,
  onStep?: (s: ByokStep) => void
): Promise<ByokSettlementResult> {
  const account = privateKeyToAccount(privateKey);
  const rpc = p.rpcUrl || "https://rpc.testnet.arc.network";
  const publicClient = publicArcClient;
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(rpc),
  });

  const budgetCap = p.usdcAmountMicro > 250_000_000n ? p.usdcAmountMicro * 2n : 500_000_000n;

  // 1. Register manifest (caller becomes registrar → permissionless settle rights)
  const registerTxHash = await walletClient.writeContract({
    address: p.vaultAddress,
    abi: SKYROUTE_VAULT_ABI,
    functionName: "registerFlightManifest",
    args: [p.callsign, p.aircraftCategory, account.address, budgetCap, p.swapVmBytecode],
  });
  onStep?.({ step: "register", txHash: registerTxHash });
  const registerReceipt = await publicClient.waitForTransactionReceipt({
    hash: registerTxHash,
    confirmations: 1,
  });

  let flightId: Hex | null = null;
  for (const log of registerReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: SKYROUTE_VAULT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "FlightManifestRegistered") {
        flightId = (decoded.args as unknown as { flightId: Hex }).flightId;
        break;
      }
    } catch {
      // Skip unrelated logs.
    }
  }
  if (!flightId) {
    throw new Error("registerFlightManifest mined but no FlightId event found.");
  }

  // 2. Approve Aqua for the real USDC pull
  const approveTxHash = await walletClient.writeContract({
    address: p.usdcAddress,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [p.aquaAddress, budgetCap],
  });
  onStep?.({ step: "approve", txHash: approveTxHash });
  await publicClient.waitForTransactionReceipt({ hash: approveTxHash, confirmations: 1 });

  // 3. Ship the identical strategy directly (maker == treasury == you)
  const strategy = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }, { type: "bytes" }],
    [flightId, account.address, budgetCap, p.swapVmBytecode]
  );
  const shipTxHash = await walletClient.writeContract({
    address: p.aquaAddress,
    abi: AQUA_SHIP_ABI,
    functionName: "ship",
    args: [p.vaultAddress, strategy, [p.usdcAddress], [budgetCap]],
  });
  onStep?.({ step: "ship", txHash: shipTxHash });
  await publicClient.waitForTransactionReceipt({ hash: shipTxHash, confirmations: 1 });

  // 4. Settle (registrar path: no allowlist needed for your own flight)
  const settleTxHash = await walletClient.writeContract({
    address: p.vaultAddress,
    abi: SKYROUTE_VAULT_ABI,
    functionName: "settleWheelsDown",
    args: [
      flightId,
      BigInt(Math.floor(p.airborneSeconds)),
      BigInt(Math.floor(p.fuelBurnKg)),
      BigInt(Math.floor(p.co2Kg)),
      p.usdcAmountMicro,
    ],
  });
  onStep?.({ step: "settle", txHash: settleTxHash });
  const settleReceipt = await publicClient.waitForTransactionReceipt({
    hash: settleTxHash,
    confirmations: 1,
  });

  onStep?.({ step: "verify" });
  const credits = (await publicClient.readContract({
    address: p.vaultAddress,
    abi: SKYROUTE_VAULT_ABI,
    functionName: "totalCarbonOffsetKg",
    args: [account.address],
  })) as bigint;

  return {
    flightId,
    registerTxHash,
    settleTxHash,
    blockNumber: Number(settleReceipt.blockNumber),
    gasUsed: settleReceipt.gasUsed.toString(),
    explorerUrl: `https://testnet.arcscan.app/tx/${settleTxHash}`,
    agentAddress: account.address,
    treasuryAddress: account.address,
    totalCarbonOffsetKg: credits.toString(),
  };
}
