/**
 * SwapVM Flight Fuel-Efficiency Bytecode Compiler
 *
 * Compiles dynamic flight fuel-burn and emission-offset curves into SwapVM
 * bytecode instructions for 1inch Aqua App execution on Arc Testnet.
 * Conforms strictly to contracts/src/SwapVMRuleEngine.sol.
 */

import type { Hex } from "viem";

/** Base allocation from duration and hourly fuel burn */
export const OP_DYNAMIC_BALANCES = 0x01;

/** Altitude cruise discount & climb thrust scale */
export const OP_PIECEWISE_LINEAR_SCALE = 0x02;

/** Carbon offset rate per tonne ($25/t USDC flat fee) */
export const OP_FLAT_FEE_AMOUNT_IN = 0x03;

/** Waypoint / descent decay */
export const OP_DECAY = 0x04;

export const VALID_OPCODES = [
  OP_DYNAMIC_BALANCES,
  OP_PIECEWISE_LINEAR_SCALE,
  OP_FLAT_FEE_AMOUNT_IN,
  OP_DECAY,
] as const;

export type SwapVMOpcode = (typeof VALID_OPCODES)[number];

export interface SwapVMCompileOptions {
  includeDecay?: boolean;
  customOpcodes?: number[];
}

export interface SwapVMDecompileResult {
  opcodes: number[];
  valid: boolean;
  hasBaseAllocation: boolean;
}

/**
 * Validates SwapVM bytecode conformity against SwapVMRuleEngine specification.
 * - Must not be empty ("0x")
 * - Must contain OP_DYNAMIC_BALANCES (0x01)
 * - Must only contain recognized opcodes (0x01 - 0x04)
 */
export function validateSwapVMBytecode(bytecode: Hex): boolean {
  if (!bytecode || !bytecode.startsWith("0x")) {
    return false;
  }

  const raw = bytecode.slice(2);
  if (raw.length === 0 || raw.length % 2 !== 0) {
    return false;
  }

  // Ensure all characters are valid hex
  if (!/^[0-9a-fA-F]+$/.test(raw)) {
    return false;
  }

  let hasBaseAllocation = false;

  for (let i = 0; i < raw.length; i += 2) {
    const op = parseInt(raw.slice(i, i + 2), 16);
    if (op === OP_DYNAMIC_BALANCES) {
      hasBaseAllocation = true;
    } else if (
      op !== OP_PIECEWISE_LINEAR_SCALE &&
      op !== OP_FLAT_FEE_AMOUNT_IN &&
      op !== OP_DECAY
    ) {
      return false; // Unknown opcode
    }
  }

  return hasBaseAllocation;
}

/**
 * Compiles a flight fuel-efficiency pricing curve into SwapVM bytecode.
 *
 * @param options Compilation options (includeDecay or customOpcodes)
 * @returns Hex-encoded SwapVM bytecode (e.g. "0x010203" or "0x01020304")
 */
export function compileSwapVMCurve(options?: SwapVMCompileOptions): Hex {
  if (options?.customOpcodes) {
    const opcodes = options.customOpcodes;
    if (opcodes.length === 0) {
      throw new Error("Cannot compile empty opcode sequence");
    }

    let hasBase = false;
    for (const op of opcodes) {
      if (!VALID_OPCODES.includes(op as SwapVMOpcode)) {
        throw new Error(
          `Invalid opcode 0x${op.toString(16).padStart(2, "0")}. Valid opcodes are 0x01 - 0x04.`
        );
      }
      if (op === OP_DYNAMIC_BALANCES) {
        hasBase = true;
      }
    }

    if (!hasBase) {
      throw new Error(
        "Invalid SwapVM curve: Missing OP_DYNAMIC_BALANCES (0x01) base allocation instruction."
      );
    }

    const hexBytes = opcodes.map((op) => op.toString(16).padStart(2, "0")).join("");
    return `0x${hexBytes}` as Hex;
  }

  const opcodes: number[] = [
    OP_DYNAMIC_BALANCES,
    OP_PIECEWISE_LINEAR_SCALE,
    OP_FLAT_FEE_AMOUNT_IN,
  ];

  if (options?.includeDecay) {
    opcodes.push(OP_DECAY);
  }

  const hexBytes = opcodes.map((op) => op.toString(16).padStart(2, "0")).join("");
  return `0x${hexBytes}` as Hex;
}

/**
 * Decompiles a SwapVM bytecode hex string into an array of numeric opcodes.
 *
 * @param bytecode Hex-encoded SwapVM bytecode
 * @returns Array of opcode integers
 */
export function decompileSwapVMBytecode(bytecode: Hex): number[] {
  if (!bytecode || !bytecode.startsWith("0x")) {
    throw new Error(`Invalid hex bytecode: expected '0x' prefix, got '${bytecode}'`);
  }

  const raw = bytecode.slice(2);
  if (raw.length === 0 || raw.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(`Invalid hex bytecode string: '${bytecode}'`);
  }

  const opcodes: number[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    opcodes.push(parseInt(raw.slice(i, i + 2), 16));
  }

  return opcodes;
}
