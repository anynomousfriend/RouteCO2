/**
 * Demo settlement scale (client + server shared, pure — no Node APIs).
 *
 * Testnet treasuries hold ~$100 USDC while real-world offset quotes run into
 * the thousands, which would brick every demo settlement at the treasury
 * guard. On-chain execution therefore runs at 1:N demo scale while all
 * displayed estimates keep full real-world economics:
 *
 *   executedMicro = floor(fullMicro / DEMO_SCALE_DIVISOR), min 1 micro
 *
 * NEXT_PUBLIC_DEMO_SCALE_DIVISOR defaults to "1000" (matches the 1:1k scale
 * already shown on the Settlement Cost tile). Set it to "1" for full-value
 * production economics. The divisor is disclosed in the UI wherever an
 * executed amount is shown, so estimates are never misrepresented.
 */

function parseDivisor(raw: string | undefined): bigint {
  const n = Number(raw ?? "1000");
  if (!Number.isFinite(n) || n < 1) return 1000n;
  return BigInt(Math.floor(n));
}

/** Reads NEXT_PUBLIC_DEMO_SCALE_DIVISOR at call time (>= 1). */
export function demoScaleDivisor(): bigint {
  try {
    const raw =
      typeof process !== "undefined"
        ? (process.env?.NEXT_PUBLIC_DEMO_SCALE_DIVISOR as string | undefined)
        : undefined;
    return parseDivisor(raw);
  } catch {
    return 1000n;
  }
}

/** Scale a full-economics micro-USDC amount down to the executed demo amount. */
export function scaleUsdcMicro(fullMicro: bigint): bigint {
  const div = demoScaleDivisor();
  if (div <= 1n) return fullMicro;
  const scaled = fullMicro / div;
  return scaled > 0n ? scaled : 1n;
}

/** "1:1k" for 1000, else "1:<n>" — for tiles, toasts, and certificates. */
export function demoScaleLabel(): string {
  const div = demoScaleDivisor();
  if (div === 1000n) return "1:1k";
  if (div === 1n) return "1:1 (full value)";
  return `1:${div.toString()}`;
}

/** Executed cost in USDC for a full-economics dollar figure (display parity). */
export function scaledUsdc(fullUsdc: number): number {
  const div = Number(demoScaleDivisor());
  if (!(div > 1)) return fullUsdc;
  return fullUsdc / div;
}
