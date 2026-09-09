import { describe, it, expect } from "vitest";
import {
  OP_DYNAMIC_BALANCES,
  OP_PIECEWISE_LINEAR_SCALE,
  OP_FLAT_FEE_AMOUNT_IN,
  OP_DECAY,
  compileSwapVMCurve,
  decompileSwapVMBytecode,
  validateSwapVMBytecode,
  type SwapVMCompileOptions,
} from "../src/swapvm-compiler.js";

describe("SwapVM Bytecode Compiler (1inch Aqua Curve Engine)", () => {
  describe("1. Opcode Constants Conformance", () => {
    it("matches SwapVMRuleEngine.sol opcodes exactly", () => {
      expect(OP_DYNAMIC_BALANCES).toBe(0x01);
      expect(OP_PIECEWISE_LINEAR_SCALE).toBe(0x02);
      expect(OP_FLAT_FEE_AMOUNT_IN).toBe(0x03);
      expect(OP_DECAY).toBe(0x04);
    });
  });

  describe("2. Bytecode Compilation", () => {
    it("compiles default standard curve to 0x010203 (base + cruise + flat fee)", () => {
      const bytecode = compileSwapVMCurve();
      expect(bytecode).toBe("0x010203");
    });

    it("compiles standard curve with decay to 0x01020304", () => {
      const bytecode = compileSwapVMCurve({ includeDecay: true });
      expect(bytecode).toBe("0x01020304");
    });

    it("compiles custom valid opcode sequences", () => {
      const options: SwapVMCompileOptions = {
        customOpcodes: [OP_DYNAMIC_BALANCES, OP_PIECEWISE_LINEAR_SCALE],
      };
      const bytecode = compileSwapVMCurve(options);
      expect(bytecode).toBe("0x0102");
    });

    it("throws error when compiling custom opcodes lacking base allocation (0x01)", () => {
      expect(() => {
        compileSwapVMCurve({
          customOpcodes: [OP_PIECEWISE_LINEAR_SCALE, OP_FLAT_FEE_AMOUNT_IN],
        });
      }).toThrow(/base allocation/i);
    });

    it("throws error when compiling unknown or invalid opcodes", () => {
      expect(() => {
        compileSwapVMCurve({
          customOpcodes: [OP_DYNAMIC_BALANCES, 0x99],
        });
      }).toThrow(/invalid opcode/i);
    });
  });

  describe("3. Bytecode Decompilation", () => {
    it("decompiles 0x010203 into opcode array [1, 2, 3]", () => {
      const opcodes = decompileSwapVMBytecode("0x010203");
      expect(opcodes).toEqual([1, 2, 3]);
    });

    it("decompiles 0x01020304 into opcode array [1, 2, 3, 4]", () => {
      const opcodes = decompileSwapVMBytecode("0x01020304");
      expect(opcodes).toEqual([1, 2, 3, 4]);
    });

    it("throws error on malformed hex or odd-length bytecode", () => {
      expect(() => decompileSwapVMBytecode("0x1")).toThrow(/invalid hex/i);
      expect(() => decompileSwapVMBytecode("0xZZ")).toThrow(/invalid hex/i);
    });
  });

  describe("4. Bytecode Validation", () => {
    it("validates standard curve bytecodes as true", () => {
      expect(validateSwapVMBytecode("0x010203")).toBe(true);
      expect(validateSwapVMBytecode("0x01020304")).toBe(true);
      expect(validateSwapVMBytecode("0x01")).toBe(true);
    });

    it("invalidates empty bytecode", () => {
      expect(validateSwapVMBytecode("0x")).toBe(false);
    });

    it("invalidates bytecode missing base allocation 0x01", () => {
      expect(validateSwapVMBytecode("0x0203")).toBe(false);
      expect(validateSwapVMBytecode("0x04")).toBe(false);
    });

    it("invalidates bytecode with unsupported opcodes", () => {
      expect(validateSwapVMBytecode("0x0105")).toBe(false);
      expect(validateSwapVMBytecode("0x0100")).toBe(false);
    });
  });
});
