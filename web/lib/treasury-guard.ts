"use client";

import { publicArcClient } from "./arc-client";

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

function usdcAddress(): `0x${string}` | null {
  const addr = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  return addr && addr.startsWith("0x") ? (addr as `0x${string}`) : null;
}

export interface TreasuryFundsCheck {
  ok: boolean;
  balanceMicro: bigint | null;
  neededMicro: bigint;
  /** True when the check itself could not run (unknown balance); caller decides. */
  unknown: boolean;
}

/**
 * Pre-flight spend guard: reads the treasury's real ARC-TESTNET USDC balance
 * and verifies it covers the settlement amount before anything is broadcast.
 * Never blocks on read failure (returns unknown:true); the chain remains the
 * final arbiter and reverts honestly if funds are missing.
 */
export async function checkTreasuryFunds(
  treasury: string,
  neededMicro: bigint
): Promise<TreasuryFundsCheck> {
  const token = usdcAddress();
  if (!token || !treasury || !treasury.startsWith("0x")) {
    return { ok: true, balanceMicro: null, neededMicro, unknown: true };
  }
  try {
    const balance = (await publicArcClient.readContract({
      address: token,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [treasury as `0x${string}`],
    })) as bigint;
    return { ok: balance >= neededMicro, balanceMicro: balance, neededMicro, unknown: false };
  } catch {
    return { ok: true, balanceMicro: null, neededMicro, unknown: true };
  }
}

/** Human-readable shortfall for toasts, e.g. "needs $12.40, holds $8.10". */
export function formatShortfall(check: TreasuryFundsCheck): string {
  const need = (Number(check.neededMicro) / 1e6).toFixed(2);
  if (check.balanceMicro === null) return `needs $${need} USDC (balance unknown)`;
  const have = (Number(check.balanceMicro) / 1e6).toFixed(2);
  return `needs $${need} USDC, treasury holds $${have} USDC`;
}

export const FAUCET_HINT =
  "Top up testnet USDC from the Circle faucet to the treasury address and retry.";

export const FAUCET_URL = "https://faucet.circle.com";

/**
 * Builds the insufficient-funds toast payload: shortfall + the exact wallet
 * address to fund + a one-click faucet action.
 */
export function insufficientFundsToast(
  check: TreasuryFundsCheck,
  treasury: string
): {
  title: string;
  description: string;
  duration: number;
  action: { label: string; onClick: () => void };
} {
  return {
    title: "Insufficient Treasury USDC",
    description:
      `${formatShortfall(check)}. ` +
      `Fund ${treasury} with Arc Testnet USDC, then retry.`,
    duration: 15000,
    action: {
      label: "Open Faucet",
      onClick: () => window.open(FAUCET_URL, "_blank", "noopener"),
    },
  };
}
