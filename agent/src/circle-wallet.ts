/**
 * Circle Agent Wallet & Policy Guards (Track 2: Arc / Circle Agent Stack)
 *
 * Implements Circle Agent Wallet management, credential resolution,
 * contract target allowlisting (SkyRouteVault), and bounded daily/per-flight
 * spend guards for autonomous aviation carbon-offset settlements on Arc Testnet.
 */

import { type Address, type Hex, isAddress } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

export interface CircleAgentWalletConfig {
  privateKey?: Hex;
  apiKey?: string;
  entitySecret?: string;
  address?: Address;
  allowedContracts?: Address[];
  maxDailyBudgetUSDC?: number;
  maxPerFlightBudgetUSDC?: number;
}

/** Default SkyRouteVault deployment on Arc Testnet */
export const DEFAULT_ALLOWED_VAULT: Address =
  (process.env.NEXT_PUBLIC_ARC_VAULT_ADDRESS as Address) ||
  (process.env.SKYROUTE_VAULT_ADDRESS as Address) ||
  "0xb579e26C81FDf858a9A6a0F3CcAB497a70343c5d";

export class CircleAgentWallet {
  private readonly privateKey?: Hex;
  private readonly apiKey?: string;
  private readonly entitySecret?: string;
  private readonly address: Address;
  private readonly account?: PrivateKeyAccount;
  private readonly allowedContracts: Set<string>;

  public readonly maxDailyBudgetUSDC: number;
  public readonly maxPerFlightBudgetUSDC: number;
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
