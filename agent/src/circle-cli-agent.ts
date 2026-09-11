/**
 * Circle Agent Wallet CLI client (Track 2: Best Agentic Economy with Circle Agent Stack).
 *
 * Ground truth: Circle Agent Stack (circle.com/agent-stack, developers.circle.com/agent-stack)
 *   - Agent Wallets: policy-controlled USDC wallets operated via Circle CLI (@circle-fin/cli).
 *   - Supported chains include ARC-TESTNET (chain ID 5042002).
 *   - `circle wallet execute "<sig>" <params...> --contract <addr> --address <addr> --chain <chain>`
 *     broadcasts a contract write from the agent wallet and returns JSON.
 *   - `circle wallet limit` (custom on-chain spending policies) is mainnet-only in CLI v1;
 *     on testnet the spending policy is enforced HERE (allowlist + caps) before broadcast.
 *
 * Zero-mock: every function shells out to the real `circle` binary with `--output json`.
 * Missing CLI, expired session, or CLI-side errors throw fatal, actionable errors.
 * No dummy fallback signer is used anywhere in this module.
 */

import { execFile } from "node:child_process";

export const CIRCLE_CLI_BIN = process.env.CIRCLE_CLI_BIN || "circle";
export const AGENT_WALLET_CHAIN = "ARC-TESTNET";
/** Provisioned 2026-09-11 via `circle wallet login --testnet` (auto-provisioned on first login). */
export const DEFAULT_AGENT_WALLET_ADDRESS = "0x96209ca47eee6de66b3660face36277e0e9bb458";

export function agentWalletAddress(): string {
  return process.env.CIRCLE_AGENT_WALLET_ADDRESS || DEFAULT_AGENT_WALLET_ADDRESS;
}

export interface CircleCliResult {
  data?: Record<string, unknown>;
  error?: { code?: string; message?: string };
}

/**
 * Runs the Circle CLI and parses `--output json`. Throws a fatal error when the
 * CLI is missing, exits non-zero, returns an error payload, or emits non-JSON.
 */
export function runCircleCli(args: string[], opts: { timeoutMs?: number } = {}): Promise<CircleCliResult> {
  return new Promise((resolve, reject) => {
    execFile(
      CIRCLE_CLI_BIN,
      args,
      { timeout: opts.timeoutMs ?? 120_000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const detail = (stderr || err.message || "").slice(0, 2000);
          reject(
            new Error(
              `Circle CLI failed (circle ${args[0] || ""} ${args[1] || ""}): ${detail} ` +
                `Hint: run \`circle wallet status\` — the agent testnet session may have expired (re-login with email OTP).`
            )
          );
          return;
        }
        const text = (stdout || "").trim();
        if (!text) {
          reject(new Error(`Circle CLI returned empty output (circle ${args.slice(0, 2).join(" ")}).`));
          return;
        }
        try {
          const parsed = JSON.parse(text) as CircleCliResult;
          if (parsed && typeof parsed === "object" && parsed.error) {
            reject(
              new Error(
                `Circle CLI error [${parsed.error.code || "unknown"}]: ${parsed.error.message || "no message"}`
              )
            );
            return;
          }
          resolve(parsed);
        } catch {
          reject(
            new Error(
              `Circle CLI returned non-JSON output (circle ${args.slice(0, 2).join(" ")}): ${text.slice(0, 500)}`
            )
          );
        }
      }
    );
  });
}

/** Executes a state-changing contract call from the Agent Wallet. Returns the raw CLI payload. */
export async function agentExecute(params: {
  signature: string;
  abiParams?: string[];
  contract: string;
  value?: string;
  walletAddress?: string;
  chain?: string;
  idempotencyKey?: string;
  estimateOnly?: boolean;
}): Promise<CircleCliResult> {
  const args = [
    "wallet",
    "execute",
    params.signature,
    ...(params.abiParams ?? []),
    "--contract",
    params.contract,
    "--address",
    params.walletAddress ?? agentWalletAddress(),
    "--chain",
    params.chain ?? AGENT_WALLET_CHAIN,
    "--output",
    "json",
  ];
  if (params.value !== undefined) args.push("--amount", params.value);
  if (params.idempotencyKey) args.push("--idempotency-key", params.idempotencyKey);
  if (params.estimateOnly) args.push("--estimate");
  return runCircleCli(args, { timeoutMs: 180_000 });
}

/**
 * Extracts the broadcast transaction hash from an `execute` payload.
 * Throws fatally when no hash-like field is present (shape drift guard).
 */
export function extractTxHash(payload: CircleCliResult): string {
  const data = (payload?.data ?? {}) as Record<string, unknown>;
  const candidates = [
    data.transactionHash,
    data.hash,
    data.txHash,
    (data.transaction as Record<string, unknown> | undefined)?.hash,
    (data.transaction as Record<string, unknown> | undefined)?.transactionHash,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^0x[0-9a-fA-F]{64}$/.test(c)) return c;
  }
  throw new Error(
    `Circle CLI execute returned no transaction hash (unexpected shape): ${JSON.stringify(payload).slice(0, 500)}`
  );
}

export interface AgentSpendingPolicy {
  /** Contract allowlist: every destination contract must be in this set. */
  allowedContracts: string[];
  /** Max USDC (whole units, e.g. 5 = 5 USDC) per single settlement. */
  maxPerFlightUSDC: number;
  /** Max USDC per rolling day across all settlements. */
  maxDailyUSDC: number;
  /** USDC already spent today (tracked by the caller/daemon). */
  spentTodayUSDC: number;
}

/**
 * Testnet spending-policy gate (CLI `wallet limit` custom policies are mainnet-only).
 * Throws on any violation BEFORE anything is broadcast.
 */
export function enforceAgentSpendingPolicy(params: {
  contract: string;
  usdcAmount: number;
  policy: AgentSpendingPolicy;
}): void {
  const dest = params.contract.toLowerCase();
  const allowed = params.policy.allowedContracts.map((c) => c.toLowerCase());
  if (!allowed.includes(dest)) {
    throw new Error(
      `Agent spending-policy violation: contract ${params.contract} is not in the allowlist (${params.policy.allowedContracts.join(", ")}).`
    );
  }
  if (!(params.usdcAmount > 0)) {
    throw new Error(`Agent spending-policy violation: settlement amount must be positive (got ${params.usdcAmount}).`);
  }
  if (params.usdcAmount > params.policy.maxPerFlightUSDC) {
    throw new Error(
      `Agent spending-policy violation: ${params.usdcAmount} USDC exceeds per-flight cap of ${params.policy.maxPerFlightUSDC} USDC.`
    );
  }
  if (params.policy.spentTodayUSDC + params.usdcAmount > params.policy.maxDailyUSDC) {
    throw new Error(
      `Agent spending-policy violation: ${params.policy.spentTodayUSDC} + ${params.usdcAmount} USDC exceeds daily cap of ${params.policy.maxDailyUSDC} USDC.`
    );
  }
}
