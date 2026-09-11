/**
 * Circle Agent Wallet CLI tests (Track 2: Agent Stack qualification).
 *
 * - Pure policy/encoding tests run anywhere.
 * - `describe("live")` hits the real Circle CLI + Arc Testnet (no mocks):
 *   requires `circle wallet login --testnet` (agent session) on this machine.
 *   Nothing in the live block broadcasts: reads + `--estimate` only.
 */
import { describe, it, expect } from "vitest";
import {
  AGENT_WALLET_CHAIN,
  DEFAULT_AGENT_WALLET_ADDRESS,
  agentExecute,
  agentWalletAddress,
  enforceAgentSpendingPolicy,
  extractTxHash,
  runCircleCli,
} from "../src/circle-cli-agent.js";
import { weiToDecimalString } from "../src/agent-wallet-settler.js";

const VAULT = "0xe6bbB15BA58E46Cd02Cfa4B842A9e3Dc3a66b57F";

describe("Agent Wallet spending policy gate (pure)", () => {
  const policy = {
    allowedContracts: [VAULT],
    maxPerFlightUSDC: 5,
    maxDailyUSDC: 50,
    spentTodayUSDC: 0,
  };

  it("allows an in-policy settlement", () => {
    expect(() =>
      enforceAgentSpendingPolicy({ contract: VAULT, usdcAmount: 2.5, policy })
    ).not.toThrow();
  });

  it("rejects non-allowlisted contracts", () => {
    expect(() =>
      enforceAgentSpendingPolicy({
        contract: "0x0000000000000000000000000000000000000001",
        usdcAmount: 1,
        policy,
      })
    ).toThrow(/allowlist/i);
  });

  it("rejects per-flight cap breaches", () => {
    expect(() =>
      enforceAgentSpendingPolicy({ contract: VAULT, usdcAmount: 5.01, policy })
    ).toThrow(/per-flight cap/i);
  });

  it("rejects daily cap breaches", () => {
    expect(() =>
      enforceAgentSpendingPolicy({
        contract: VAULT,
        usdcAmount: 2,
        policy: { ...policy, spentTodayUSDC: 49 },
      })
    ).toThrow(/daily cap/i);
  });

  it("rejects non-positive amounts", () => {
    expect(() =>
      enforceAgentSpendingPolicy({ contract: VAULT, usdcAmount: 0, policy })
    ).toThrow(/positive/i);
  });
});

describe("weiToDecimalString (pure)", () => {
  it("formats whole and fractional native values", () => {
    expect(weiToDecimalString(5_000_000_000_000_000n)).toBe("0.005");
    expect(weiToDecimalString(1_000_000_000_000_000_000n)).toBe("1");
    expect(weiToDecimalString(100_000_000_000_000n)).toBe("0.0001");
  });
});

describe("extractTxHash shape guard (pure)", () => {
  it("finds hashes in known payload shapes and rejects the rest", () => {
    const h = "0x" + "ab".repeat(32);
    expect(extractTxHash({ data: { transactionHash: h } })).toBe(h);
    expect(extractTxHash({ data: { transaction: { hash: h } } })).toBe(h);
    expect(() => extractTxHash({ data: { foo: 1 } })).toThrow(/no transaction hash/i);
  });
});

describe("live Circle Agent Wallet on ARC-TESTNET (no broadcasts)", () => {
  it("resolves the provisioned agent wallet address", () => {
    expect(agentWalletAddress()).toBe(DEFAULT_AGENT_WALLET_ADDRESS);
    expect(AGENT_WALLET_CHAIN).toBe("ARC-TESTNET");
  });

  it("agent testnet session is VALID", async () => {
    const res = await runCircleCli(["wallet", "status", "--output", "json"]);
    const data = res.data as Record<string, unknown> | undefined;
    expect(JSON.stringify(data)).toMatch(/testnet/i);
  }, 60_000);

  it("agent wallet has a readable USDC balance", async () => {
    const res = await runCircleCli([
      "wallet",
      "balance",
      "--address",
      agentWalletAddress(),
      "--chain",
      AGENT_WALLET_CHAIN,
      "--output",
      "json",
    ]);
    const balances = (res.data as { balances?: unknown[] })?.balances;
    expect(Array.isArray(balances)).toBe(true);
  }, 90_000);

  it("registerFlightManifest estimation succeeds without broadcasting", async () => {
    const res = await agentExecute({
      signature: "registerFlightManifest(string,string,address,uint256,bytes)",
      abiParams: ["CLITEST", "NARROW_BODY", agentWalletAddress(), "500000000", "0x010203"],
      contract: VAULT,
      estimateOnly: true,
    });
    expect(JSON.stringify(res.data)).toMatch(/gasLimit|networkFee/i);
  }, 120_000);
});
