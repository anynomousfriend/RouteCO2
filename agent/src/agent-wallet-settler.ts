/**
 * Autonomous settlement via the Circle Agent Wallet on Arc Testnet (Chain ID 5042002).
 *
 * Proven live architecture (verified 2026-09-11, flight AGENTW2):
 *   - Agent Wallet (register + settle) <-> Treasury holder (approve + ship).
 *   - This matches the vault's designed separation: anyone may register, the
 *     maker-treasury ships its own Aqua strategy, and owner-authorized agents
 *     (or the registrar) settle on touchdown.
 *   - Rationale: Circle CLI v1 cannot encode `address[]`/`uint256[]` calldata,
 *     so `ship()` cannot be broadcast from the agent wallet via the CLI
 *     (local `cast call` simulation proves the call itself is valid from the
 *     wallet). The treasury ships with any EOA/SDK signer instead.
 *   - Before broadcasting settle, the exact call is preflighted with
 *     `simulateContract`: an unshipped strategy fails fast with the real
 *     on-chain revert reason instead of burning gas.
 *
 * On-chain authorization: the vault owner authorized this wallet via
 * setAuthorizedAgent (tx 0xab88fc77ddc6570190b7bf857a6169c889c8bda815a42d4578b75b5cf20c42b6).
 */

import { randomUUID } from "node:crypto";
import {
  createPublicClient,
  http,
  keccak256,
  encodePacked,
  type Address,
  type Hex,
  type Hash,
} from "viem";
import { arcTestnet } from "./circle-agent.js";
import {
  AGENT_WALLET_CHAIN,
  agentExecute,
  agentWalletAddress,
  enforceAgentSpendingPolicy,
  extractTxHash,
  type AgentSpendingPolicy,
} from "./circle-cli-agent.js";

/** Vault ABI surface used here: reads + the agent-broadcast calls (no arrays). */
const VAULT_ABI = [
  {
    type: "function",
    name: "authorizedAgents",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "isAuthorized", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalCarbonOffsetKg",
    inputs: [{ name: "treasury", type: "address" }],
    outputs: [{ name: "offsetKg", type: "uint256" }],
    stateMutability: "view",
  },
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
    stateMutability: "payable",
  },
] as const;

export const SKYROUTE_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_ARC_VAULT_ADDRESS ||
  "0xe6bbB15BA58E46Cd02Cfa4B842A9e3Dc3a66b57F") as Address;

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (required for Agent Wallet settlement).`);
  return v;
}

export const AQUA_CORE_ADDRESS = () => requiredEnv("NEXT_PUBLIC_AQUA_CORE_ADDRESS") as Address;
export const USDC_ADDRESS = () => requiredEnv("NEXT_PUBLIC_USDC_ADDRESS") as Address;

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"),
});

/** Converts a wei-denominated bigint into a plain decimal string for `--amount`. */
export function weiToDecimalString(wei: bigint): string {
  const BASE = 1_000_000_000_000_000_000n;
  const whole = wei / BASE;
  const frac = (wei % BASE).toString().padStart(18, "0").replace(/0+$/, "");
  return frac === "" ? whole.toString() : `${whole}.${frac}`;
}

async function waitReceipt(hash: Hash) {
  return publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
}

export interface AgentWalletSettlementInput {
  callsign: string;
  aircraftCategory?: string;
  airborneSeconds: number;
  fuelBurnKg: number;
  co2Kg: number;
  /** micro-USDC (6 decimals), full carbon valuation pulled via Aqua. */
  usdcMicro: bigint;
  swapVmBytecode?: Hex;
  /** Treasury that shipped + approved the Aqua strategy (maker ships its own). */
  treasury: string;
  policy: AgentSpendingPolicy;
  /** Allowlist must contain the vault; enforced before broadcast. */
  allowedContracts: string[];
}

export interface AgentWalletSettlementResult {
  flightId: Hex;
  callsign: string;
  registerTxHash: string;
  settleTxHash: string;
  blockNumber: number;
  explorerUrl: string;
  agentAddress: string;
  treasuryAddress: string;
  totalCarbonOffsetKg: string;
}

export async function settleFlightViaAgentWallet(
  input: AgentWalletSettlementInput
): Promise<AgentWalletSettlementResult> {
  const wallet = agentWalletAddress();
  const vault = SKYROUTE_VAULT_ADDRESS;
  const treasury = input.treasury as Address;
  const bytecode = (input.swapVmBytecode || "0x010203") as Hex;
  const category = input.aircraftCategory || "NARROW_BODY";

  // 0. Policy gate: nothing is broadcast on violation.
  const usdcWhole = Number(input.usdcMicro) / 1e6;
  enforceAgentSpendingPolicy({
    contract: vault,
    usdcAmount: usdcWhole,
    policy: { ...input.policy, allowedContracts: input.allowedContracts },
  });

  // 1. Register manifest (agent wallet becomes registrar).
  const budgetCap = input.usdcMicro > 250_000_000n ? input.usdcMicro * 2n : 500_000_000n;
  const registerPayload = await agentExecute({
    signature: "registerFlightManifest(string,string,address,uint256,bytes)",
    abiParams: [input.callsign, category, treasury, budgetCap.toString(), bytecode],
    contract: vault,
    idempotencyKey: randomUUID(),
  });
  const registerTxHash = extractTxHash(registerPayload);
  const registerReceipt = await waitReceipt(registerTxHash as Hash);

  let flightId: Hex;
  if (registerReceipt.logs?.[0]?.topics?.[1]) {
    flightId = registerReceipt.logs[0].topics[1] as Hex;
  } else {
    const block = await publicClient.getBlock({ blockHash: registerReceipt.blockHash });
    flightId = keccak256(
      encodePacked(["string", "address", "uint256"], [input.callsign, treasury, block.timestamp])
    );
  }

  // 2. Preflight the exact settle call (free): an unshipped strategy fails here
  // with the real on-chain revert reason instead of burning gas. The treasury
  // holder ships + approves via any EOA/SDK signer before this point.
  const scaledNativeValue =
    input.usdcMicro > 0n ? input.usdcMicro * 1_000_000_000n : 10_000_000_000_000_000n;
  const settleArgs = [
    flightId,
    BigInt(Math.floor(input.airborneSeconds)),
    BigInt(Math.floor(input.fuelBurnKg)),
    BigInt(Math.floor(input.co2Kg)),
    input.usdcMicro,
  ] as const;
  try {
    await publicClient.simulateContract({
      address: vault,
      abi: VAULT_ABI,
      functionName: "settleWheelsDown",
      args: [...settleArgs],
      account: wallet as Address,
      value: scaledNativeValue,
    });
  } catch (err) {
    throw new Error(
      `Agent settle preflight reverted (treasury ${treasury} likely never shipped + approved ` +
        `the Aqua strategy for flight ${flightId}): ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 3. Settle with scaled native USDC value (1:1000 demo contribution, mirrors /api/settle).
  const settlePayload = await agentExecute({
    signature: "settleWheelsDown(bytes32,uint256,uint256,uint256,uint256)",
    abiParams: [
      flightId,
      BigInt(Math.floor(input.airborneSeconds)).toString(),
      BigInt(Math.floor(input.fuelBurnKg)).toString(),
      BigInt(Math.floor(input.co2Kg)).toString(),
      input.usdcMicro.toString(),
    ],
    contract: vault,
    value: weiToDecimalString(scaledNativeValue),
    idempotencyKey: randomUUID(),
  });
  const settleTxHash = extractTxHash(settlePayload);
  const settleReceipt = await waitReceipt(settleTxHash as Hash);

  const credits = await publicClient.readContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "totalCarbonOffsetKg",
    args: [treasury],
  });

  return {
    flightId,
    callsign: input.callsign,
    registerTxHash,
    settleTxHash,
    blockNumber: Number(settleReceipt.blockNumber),
    explorerUrl: `https://testnet.arcscan.app/tx/${settleTxHash}`,
    agentAddress: wallet,
    treasuryAddress: treasury,
    totalCarbonOffsetKg: credits.toString(),
  };
}

/** Reads whether an address is an owner-authorized agent on the vault (free, no broadcast). */
export async function isAgentAuthorizedOnVault(agent: string): Promise<boolean> {
  return publicClient.readContract({
    address: SKYROUTE_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "authorizedAgents",
    args: [agent as Address],
  });
}

export { AGENT_WALLET_CHAIN };
