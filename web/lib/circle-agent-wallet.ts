/**
 * Circle Agent Wallet CLI helper for Next.js server routes (Track 2: Agent Stack).
 *
 * The autonomous settlement path signs with the Circle Agent Wallet
 * (0x96209ca47eee6de66b3660face36277e0e9bb458 on ARC-TESTNET) via the
 * `circle` CLI instead of a raw server EOA key. Reads + receipts still go
 * through the viem public client in the route.
 *
 * Requires on the server machine: `@circle-fin/cli` installed and an active
 * agent testnet session (`circle wallet login --testnet`, 28-day validity).
 * Every failure is loud (HTTP 500 with the CLI's message) — no EOA fallback.
 */
import { execFile } from "node:child_process";

export const CIRCLE_CLI_BIN = process.env.CIRCLE_CLI_BIN || "circle";
export const AGENT_WALLET_CHAIN = "ARC-TESTNET";
export const DEFAULT_AGENT_WALLET_ADDRESS = "0x96209ca47eee6de66b3660face36277e0e9bb458";

export function circleAgentWalletAddress(): string {
  return process.env.CIRCLE_AGENT_WALLET_ADDRESS || DEFAULT_AGENT_WALLET_ADDRESS;
}

function runCircle(args: string[], timeoutMs = 590_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    execFile(CIRCLE_CLI_BIN, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const detail = (stderr || err.message || "").slice(0, 2000);
        reject(
          new Error(
            `Circle Agent Wallet execution failed: ${detail} ` +
              `Hint: the server needs \`circle wallet login --testnet\` (session lasts 28 days).`
          )
        );
        return;
      }
      try {
        const parsed = JSON.parse((stdout || "").trim()) as {
          data?: Record<string, unknown>;
          error?: { code?: string; message?: string };
        };
        if (parsed?.error) {
          reject(new Error(`Circle Agent Wallet error [${parsed.error.code || "unknown"}]: ${parsed.error.message || "no message"}`));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error(`Circle CLI returned non-JSON output: ${(stdout || "").slice(0, 500)}`));
      }
    });
  });
}

/** Broadcasts a contract write from the Agent Wallet. Resolves to the raw CLI payload. */
export async function agentWalletExecute(params: {
  signature: string;
  abiParams?: string[];
  contract: string;
  value?: string;
  idempotencyKey?: string;
}): Promise<unknown> {
  const { randomUUID } = await import("node:crypto");
  const args = [
    "wallet",
    "execute",
    params.signature,
    ...(params.abiParams ?? []),
    "--contract",
    params.contract,
    "--address",
    circleAgentWalletAddress(),
    "--chain",
    AGENT_WALLET_CHAIN,
    "--output",
    "json",
  ];
  if (params.value !== undefined) args.push("--amount", params.value);
  args.push("--idempotency-key", params.idempotencyKey || randomUUID());
  return runCircle(args);
}

/** Extracts the broadcast tx hash from an execute payload (shape-drift guarded). */
export function extractAgentTxHash(payload: unknown): string {
  const data = (payload as { data?: Record<string, unknown> })?.data ?? {};
  const nested = data.transaction as Record<string, unknown> | undefined;
  const candidates = [data.txHash, data.transactionHash, data.hash, nested?.hash, nested?.transactionHash];
  for (const c of candidates) {
    if (typeof c === "string" && /^0x[0-9a-fA-F]{64}$/.test(c)) return c;
  }
  throw new Error(`Circle execute returned no transaction hash: ${JSON.stringify(payload).slice(0, 500)}`);
}

/** wei bigint -> plain decimal string for the CLI `--amount` flag. */
export function weiToDecimalString(wei: bigint): string {
  const BASE = 1_000_000_000_000_000_000n;
  const whole = wei / BASE;
  const frac = (wei % BASE).toString().padStart(18, "0").replace(/0+$/, "");
  return frac === "" ? whole.toString() : `${whole}.${frac}`;
}

const REGISTER_EVENT_ABI = [
  {
    type: "event",
    name: "FlightManifestRegistered",
    inputs: [
      { name: "flightId", type: "bytes32", indexed: true },
      { name: "callsign", type: "string", indexed: false },
      { name: "treasury", type: "address", indexed: false },
      { name: "maxBudget", type: "uint256", indexed: false },
    ],
  },
] as const;

const SETTLED_EVENT_ABI = [
  {
    type: "event",
    name: "WheelsDownSettled",
    inputs: [
      { name: "flightId", type: "bytes32", indexed: true },
      { name: "callsign", type: "string", indexed: false },
      { name: "airborneSeconds", type: "uint256", indexed: false },
      { name: "co2Kg", type: "uint256", indexed: false },
      { name: "usdcAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

type PublicClientLike = {
  getLogs: (args: Record<string, unknown>) => Promise<Array<{ transactionHash: string; args?: Record<string, unknown> }>>;
};

/**
 * Slow-relayer recovery: after a CLI TIMEOUT, the transaction usually still
 * lands on Arc (sub-second finality). Poll chain logs for the register event
 * matching (callsign, treasury) instead of trusting the CLI poller.
 */
export async function recoverRegisterFromLogs(params: {
  publicClient: PublicClientLike;
  vault: string;
  callsign: string;
  treasury: string;
  fromBlock: bigint;
  timeoutMs?: number;
}): Promise<{ flightId: string; txHash: string } | null> {
  const deadline = Date.now() + (params.timeoutMs ?? 240_000);
  while (Date.now() < deadline) {
    try {
      const logs = await params.publicClient.getLogs({
        address: params.vault,
        event: REGISTER_EVENT_ABI[0],
        fromBlock: params.fromBlock,
        toBlock: "latest",
      });
      for (const log of logs) {
        const a = log.args ?? {};
        if (
          typeof a.callsign === "string" &&
          a.callsign === params.callsign &&
          typeof a.treasury === "string" &&
          (a.treasury as string).toLowerCase() === params.treasury.toLowerCase() &&
          typeof a.flightId === "string"
        ) {
          return { flightId: a.flightId, txHash: log.transactionHash };
        }
      }
    } catch {
      // RPC hiccup: keep polling until the deadline.
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
  return null;
}

/** Slow-relayer recovery for the settle step (flightId is indexed). */
export async function recoverSettleFromLogs(params: {
  publicClient: PublicClientLike;
  vault: string;
  flightId: string;
  fromBlock: bigint;
  timeoutMs?: number;
}): Promise<string | null> {
  const deadline = Date.now() + (params.timeoutMs ?? 240_000);
  while (Date.now() < deadline) {
    try {
      const logs = await params.publicClient.getLogs({
        address: params.vault,
        event: SETTLED_EVENT_ABI[0],
        args: { flightId: params.flightId },
        fromBlock: params.fromBlock,
        toBlock: "latest",
      });
      if (logs.length > 0) return logs[0].transactionHash;
    } catch {
      // RPC hiccup: keep polling until the deadline.
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
  return null;
}

/** True when an error is the CLI's slow-relayer TIMEOUT (tx may still land). */
export function isCircleTimeout(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timed out/i.test(msg);
}
