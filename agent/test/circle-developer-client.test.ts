import { describe, it, expect } from "vitest";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_EXPLORER,
  ARC_TESTNET_USDC_ADDRESS,
  CIRCLE_PAYMASTER_ARC_TESTNET,
  createCircleTransfer,
  getCircleWalletBalance,
} from "../src/circle-developer-client.js";

describe("Circle Developer-Controlled Wallets client (ground-truth constants)", () => {
  it("exposes Arc Testnet + USDC + Paymaster ground truth", () => {
    expect(ARC_TESTNET_CHAIN_ID).toBe(5042002);
    expect(ARC_TESTNET_RPC_URL).toBe("https://rpc.testnet.arc.network");
    expect(ARC_TESTNET_EXPLORER).toBe("https://testnet.arcscan.app");
    expect(ARC_TESTNET_USDC_ADDRESS).toBe("0x3600000000000000000000000000000000000000");
    expect(CIRCLE_PAYMASTER_ARC_TESTNET).toContain("0x31BE08D380A21fc740883c0BC434FcFc88740b58");
    expect(CIRCLE_PAYMASTER_ARC_TESTNET).toContain("0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966");
  });

  it("fails loudly without Circle API credentials (no mock fallback)", async () => {
    const savedKey = process.env.CIRCLE_API_KEY;
    const savedSecret = process.env.CIRCLE_ENTITY_SECRET;
    delete process.env.CIRCLE_API_KEY;
    delete process.env.CIRCLE_ENTITY_SECRET;
    try {
      await expect(
        createCircleTransfer(
          {
            walletAddress: "0x0000000000000000000000000000000000000001",
            destinationAddress: "0x0000000000000000000000000000000000000002",
            amounts: ["1"],
          },
          { apiKey: "", entitySecret: "" }
        )
      ).rejects.toThrow(/credentials missing/i);
      await expect(getCircleWalletBalance("wallet-id", { apiKey: "", entitySecret: "" })).rejects.toThrow(
        /credentials missing/i
      );
    } finally {
      if (savedKey !== undefined) process.env.CIRCLE_API_KEY = savedKey;
      if (savedSecret !== undefined) process.env.CIRCLE_ENTITY_SECRET = savedSecret;
    }
  });

  it("validates transfer inputs before touching the network", async () => {
    await expect(
      createCircleTransfer(
        { destinationAddress: "", amounts: ["1"] },
        { apiKey: "k", entitySecret: "s" }
      )
    ).rejects.toThrow(/destinationAddress/i);
  });
});
