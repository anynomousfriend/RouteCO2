/**
 * Circle Agent Wallet & Policy Guards (Track 2: Arc / Circle Agent Stack)
 *
 * Implements Circle Agent Wallet management, credential resolution,
 * contract target allowlisting (SkyRouteVault), and bounded daily/per-flight
 * spend guards for autonomous aviation carbon-offset settlements on Arc Testnet.
 *
 * Circle Developer-Controlled Wallets ground truth (developers.circle.com):
 * - Server SDK: @circle-fin/developer-controlled-wallets,
 *   initiateDeveloperControlledWalletsClient({ apiKey, entitySecret }).
 * - Arc wallets: createWallets({ walletSetId, blockchains: ["ARC-TESTNET"], accountType }).
 * - Gas Station (developer-sponsored gas): requires SCA wallets; Arc Testnet default
 *   policy auto-sponsors qualifying SCA transactions (daily limit 50 USDC). See
 *   agent/src/circle-developer-client.ts for transfer/polling helpers and the
 *   Circle Paymaster (ARC-TESTNET) addresses for user-pays-USDC ERC-4337 flows.
 * This class is the local policy/signer counterpart; Circle API calls live in
 * circle-developer-client.ts and throw fatally when CIRCLE_API_KEY/ENTITY_SECRET
 * are missing (no silent mock fallback).
 */

import { type Address, type Hex, isAddress } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { CircleAccountType } from "./circle-developer-client.js";

export interface CircleAgentWalletConfig {
  privateKey?: Hex;
  apiKey?: string;
  entitySecret?: string;
  address?: Address;
  /** Circle Developer-Controlled Wallet ID (for API transfers/balance checks) */
  walletId?: string;
  /** Circle Wallet Set ID the wallet belongs to */
  walletSetId?: string;
  /** SCA enables Gas Station gasless flows; EOA is a plain signer. Defaults to SCA. */
  accountType?: CircleAccountType;
  allowedContracts?: Address[];
  maxDailyBudgetUSDC?: number;
  maxPerFlightBudgetUSDC?: number;
}

/** Default SkyRouteVault deployment on Arc Testnet */
export const DEFAULT_ALLOWED_VAULT: Address =
  (process.env.NEXT_PUBLIC_ARC_VAULT_ADDRESS as Address) ||
  (process.env.SKYROUTE_VAULT_ADDRESS as Address) ||
  "0x469CA8E59ae25CBEEC2eA52617163E2396B9bdA1";

export class CircleAgentWallet {
  private readonly privateKey?: Hex;
  private readonly apiKey?: string;
  private readonly entitySecret?: string;
  private readonly address: Address;
  private readonly account?: PrivateKeyAccount;
  private readonly allowedContracts: Set<string>;

  public readonly maxDailyBudgetUSDC: number;
  public readonly maxPerFlightBudgetUSDC: number;
  /** Circle Developer-Controlled Wallet ID, when managed via Circle APIs */
  public readonly walletId?: string;
  /** Circle Wallet Set ID, when managed via Circle APIs */
  public readonly walletSetId?: string;
  /** SCA enables Gas Station gasless flows; EOA is a plain signer */
  public readonly accountType: CircleAccountType;
  private dailySpendUSDC: number = 0;
  private lastResetTimestamp: number = Date.now();

  constructor(config: CircleAgentWalletConfig = {}) {
    // 1. Resolve private key from config or environment
    const pk =
      config.privateKey ||
      (process.env.CIRCLE_AGENT_PRIVATE_KEY as Hex) ||
      (process.env.DEPLOYER_PRIVATE_KEY
        ? (process.env.DEPLOYER_PRIVATE_KEY.startsWith("0x")
            ? process.env.DEPLOYER_PRIVATE_KEY
            : `0x${process.env.DEPLOYER_PRIVATE_KEY}`) as Hex
        : undefined);

    this.privateKey = pk;
    this.apiKey = config.apiKey || process.env.CIRCLE_API_KEY;
    this.entitySecret = config.entitySecret || process.env.CIRCLE_ENTITY_SECRET;
    this.walletId = config.walletId || process.env.CIRCLE_WALLET_ID;
    this.walletSetId = config.walletSetId || process.env.CIRCLE_WALLET_SET_ID;
    this.accountType = config.accountType || ((process.env.CIRCLE_ACCOUNT_TYPE as CircleAccountType) ?? "SCA");

    if (this.privateKey) {
      this.account = privateKeyToAccount(this.privateKey);
      this.address = this.account.address;
    } else if (config.address && isAddress(config.address)) {
      this.address = config.address;
    } else if (process.env.CIRCLE_AGENT_ADDRESS && isAddress(process.env.CIRCLE_AGENT_ADDRESS)) {
      this.address = process.env.CIRCLE_AGENT_ADDRESS as Address;
    } else {
      throw new Error(
        "Circle Agent wallet credentials missing: Please specify CIRCLE_AGENT_PRIVATE_KEY, DEPLOYER_PRIVATE_KEY, or CIRCLE_AGENT_ADDRESS in environment or constructor."
      );
    }

    // 2. Configure contract target allowlist
    const contracts = config.allowedContracts || [DEFAULT_ALLOWED_VAULT];
    this.allowedContracts = new Set(contracts.map((c) => c.toLowerCase()));

    // 3. Configure spending limits
    this.maxDailyBudgetUSDC =
      config.maxDailyBudgetUSDC ??
      (process.env.DISPATCHER_MAX_DAILY_BUDGET_USDC
        ? Number(process.env.DISPATCHER_MAX_DAILY_BUDGET_USDC)
        : 5000.0);

    this.maxPerFlightBudgetUSDC =
      config.maxPerFlightBudgetUSDC ??
      (process.env.DISPATCHER_MAX_PER_FLIGHT_BUDGET_USDC
        ? Number(process.env.DISPATCHER_MAX_PER_FLIGHT_BUDGET_USDC)
        : 500.0);
  }

  /**
   * Resolves the agent wallet address.
   */
  public getAddress(): Address {
    return this.address;
  }

  /**
   * Returns the Viem PrivateKeyAccount if initialized from a private key.
   */
  public getAccount(): PrivateKeyAccount | undefined {
    return this.account;
  }

  /**
   * Checks whether the given contract address is in the allowlist.
   */
  public isContractAllowed(target: Address): boolean {
    if (!target) return false;
    return this.allowedContracts.has(target.toLowerCase());
  }

  /**
   * Asserts that target address is in the allowlist, throwing if unauthorized.
   */
  public assertContractAllowed(target: Address): void {
    if (!this.isContractAllowed(target)) {
      throw new Error(
        `Unauthorized target contract ${target}: Not present in Circle Agent allowlist. Allowed contracts: [${Array.from(
          this.allowedContracts
        ).join(", ")}]`
      );
    }
  }

  /**
   * Dynamically adds a contract address to the allowlist.
   */
  public addAllowedContract(target: Address): void {
    if (isAddress(target)) {
      this.allowedContracts.add(target.toLowerCase());
    }
  }

  /**
   * Validates whether a prospective spend satisfies per-flight and daily caps.
   * Throws an error if any policy guard is breached.
   */
  public validateSpend(costUSDC: number): void {
    if (costUSDC <= 0) {
      return;
    }

    if (costUSDC > this.maxPerFlightBudgetUSDC) {
      throw new Error(
        `Budget policy violation: flight offset cost ${costUSDC.toFixed(
          2
        )} USDC exceeds max per-flight budget cap of ${this.maxPerFlightBudgetUSDC.toFixed(
          2
        )} USDC`
      );
    }

    if (this.dailySpendUSDC + costUSDC > this.maxDailyBudgetUSDC) {
      throw new Error(
        `Budget policy violation: cumulative spend ${(this.dailySpendUSDC + costUSDC).toFixed(
          2
        )} USDC exceeds max daily budget cap of ${this.maxDailyBudgetUSDC.toFixed(2)} USDC`
      );
    }
  }

  /**
   * Records an executed spend, validating against limits and updating cumulative tracking.
   */
  public recordSpend(costUSDC: number): void {
    this.validateSpend(costUSDC);
    this.dailySpendUSDC += costUSDC;
  }

  /**
   * Returns the current accumulated daily spend in USDC.
   */
  public getDailySpend(): number {
    return this.dailySpendUSDC;
  }

  /**
   * Returns the remaining spend available for today in USDC.
   */
  public getRemainingDailyBudget(): number {
    return Math.max(0, this.maxDailyBudgetUSDC - this.dailySpendUSDC);
  }

  /**
   * Returns true when this wallet can use Gas Station gasless flows:
   * SCA account type (EOA cannot be sponsored).
   */
  public isGaslessCapable(): boolean {
    return this.accountType === "SCA";
  }

  /**
   * Asserts Circle API credentials exist; throws fatally otherwise (no mock fallback).
   */
  public assertCircleApiConfigured(): void {
    if (!this.apiKey || !this.entitySecret) {
      throw new Error(
        "Circle API credentials missing: set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env to use " +
          "Developer-Controlled Wallets (see agent/src/circle-developer-client.ts)."
      );
    }
  }

  /**
   * Resets the daily spend accumulator.
   */
  public resetDailySpend(): void {
    this.dailySpendUSDC = 0;
    this.lastResetTimestamp = Date.now();
  }
}

/**
 * Convenience helper to instantiate a CircleAgentWallet
 */
export function createCircleAgentWallet(
  config: CircleAgentWalletConfig = {}
): CircleAgentWallet {
  return new CircleAgentWallet(config);
}
