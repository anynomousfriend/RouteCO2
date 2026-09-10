/**
 * Arc Testnet On-Chain Settlement Broadcaster (Chain ID 5042002)
 *
 * Implements autonomous transaction broadcasting, receipt waiting,
 * and explorer verification for flight manifest registration and wheels-down
 * carbon offset settlements on Arc Testnet.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  decodeEventLog,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Hash,
} from "viem";
import { arcTestnet } from "./circle-agent.js";
import { CircleAgentWallet, DEFAULT_ALLOWED_VAULT } from "./circle-wallet.js";

/**
 * Full ABI for SkyRouteVault matching contracts/src/interfaces/ISkyRouteVault.sol
 */
export const SKYROUTE_VAULT_FULL_ABI = [
  {
    type: "function",
    name: "registerFlightManifest",
    inputs: [
      { name: "callsign", type: "string" },
      { name: "aircraftCategory", type: "string" },
      { name: "treasury", type: "address" },
      { name: "maxBudgetUSDC", type: "uint256" },
      { name: "swapVmBytecode", type: "bytes" },
    ],
    outputs: [{ name: "flightId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "registerFlightManifest",
    inputs: [
      { name: "callsign", type: "string" },
      { name: "aircraftCategory", type: "string" },
      { name: "treasury", type: "address" },
      { name: "maxBudgetUSDC", type: "uint256" },
    ],
    outputs: [{ name: "flightId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settleWheelsDown",
    inputs: [
      { name: "flightId", type: "bytes32" },
      { name: "airborneSeconds", type: "uint256" },
      { name: "fuelBurnKg", type: "uint256" },
      { name: "co2Kg", type: "uint256" },
      { name: "usdcAmount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "manifests",
    inputs: [{ name: "flightId", type: "bytes32" }],
    outputs: [
      { name: "callsign", type: "string" },
      { name: "aircraftCategory", type: "string" },
      { name: "treasury", type: "address" },
      { name: "maxBudgetUSDC", type: "uint256" },
      { name: "swapVmBytecode", type: "bytes" },
      { name: "strategyHash", type: "bytes32" },
      { name: "settled", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalCarbonOffsetKg",
    inputs: [{ name: "treasury", type: "address" }],
    outputs: [{ name: "totalOffset", type: "uint256" }],
    stateMutability: "view",
  },
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

export interface ArcSettlerConfig {
  wallet?: CircleAgentWallet;
  vaultAddress?: Address;
  rpcUrl?: string;
}

export interface RegisterManifestResult {
  flightId: Hex;
  txHash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
  explorerUrl: string;
}

export interface SettlementReceipt {
  txHash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
  explorerUrl: string;
}

export class ArcSettler {
  public readonly wallet: CircleAgentWallet;
  public readonly vaultAddress: Address;
  public readonly rpcUrl: string;
  public readonly publicClient: PublicClient;
  public readonly walletClient?: WalletClient;

  constructor(config: ArcSettlerConfig = {}) {
    this.wallet = config.wallet ?? new CircleAgentWallet();
    this.vaultAddress = config.vaultAddress ?? DEFAULT_ALLOWED_VAULT;
    this.rpcUrl =
      config.rpcUrl ??
      process.env.ARC_RPC_URL ??
      "https://rpc.testnet.arc.network";

    // Enforce allowlist policy check
    this.wallet.assertContractAllowed(this.vaultAddress);

    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(this.rpcUrl),
    });

    const account = this.wallet.getAccount();
    if (account) {
      this.walletClient = createWalletClient({
        account,
        chain: arcTestnet,
        transport: http(this.rpcUrl),
      });
    }
  }

  /**
   * Returns current block number from Arc Testnet RPC
   */
  public async getBlockNumber(): Promise<bigint> {
    return await this.publicClient.getBlockNumber();
  }

  /**
   * Returns chain ID
   */
  public async getChainId(): Promise<number> {
    return await this.publicClient.getChainId();
  }

  /**
   * Constructs ArcScan transaction URL
   */
  public getExplorerTxUrl(txHash: Hash): string {
    return `https://testnet.arcscan.app/tx/${txHash}`;
  }

  /**
   * Constructs ArcScan address URL
   */
  public getExplorerAddressUrl(address: Address): string {
    return `https://testnet.arcscan.app/address/${address}`;
  }

  /**
   * Encodes calldata for registerFlightManifest
   */
  public encodeRegisterManifest(
    callsign: string,
    aircraftCategory: string,
    treasury: Address,
    maxBudgetUSDC: bigint,
    swapVmBytecode: Hex
  ): Hex {
    this.wallet.assertContractAllowed(this.vaultAddress);
    return encodeFunctionData({
      abi: SKYROUTE_VAULT_FULL_ABI,
      functionName: "registerFlightManifest",
      args: [callsign, aircraftCategory, treasury, maxBudgetUSDC, swapVmBytecode],
    });
  }

  /**
   * Encodes calldata for settleWheelsDown
   */
  public encodeSettleWheelsDown(
    flightId: Hex,
    airborneSeconds: bigint | number,
    fuelBurnKg: bigint | number,
    co2Kg: bigint | number,
    usdcAmount: bigint
  ): Hex {
    this.wallet.assertContractAllowed(this.vaultAddress);

    // Validate spend policy against limits (convert micro-USDC to float USDC)
    const costUSDC = Number(usdcAmount) / 1_000_000;
    this.wallet.validateSpend(costUSDC);

    return encodeFunctionData({
      abi: SKYROUTE_VAULT_FULL_ABI,
      functionName: "settleWheelsDown",
      args: [
        flightId,
        BigInt(airborneSeconds),
        BigInt(fuelBurnKg),
        BigInt(co2Kg),
        usdcAmount,
      ],
    });
  }

  /**
   * Broadcasts registerFlightManifest to Arc Testnet and awaits confirmation
   */
  public async registerFlightManifest(
    callsign: string,
    aircraftCategory: string,
    treasury: Address,
    maxBudgetUSDC: bigint,
    swapVmBytecode: Hex
  ): Promise<RegisterManifestResult> {
    if (!this.walletClient || !this.walletClient.account) {
      throw new Error(
        "ArcSettler walletClient is not initialized with a signer account. Specify private key in CircleAgentWallet."
      );
    }

    const data = this.encodeRegisterManifest(
      callsign,
      aircraftCategory,
      treasury,
      maxBudgetUSDC,
      swapVmBytecode
    );

    const txHash = await this.walletClient.sendTransaction({
      to: this.vaultAddress,
      data,
      chain: arcTestnet,
      account: this.walletClient.account,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Extract flightId from event logs if available
    let flightId: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: SKYROUTE_VAULT_FULL_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "FlightManifestRegistered") {
          flightId = (decoded.args as { flightId: Hex }).flightId;
          break;
        }
      } catch {
        // Skip logs from other contracts or unhandled events
      }
    }

    return {
      flightId,
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      explorerUrl: this.getExplorerTxUrl(txHash),
    };
  }

  /**
   * Broadcasts settleWheelsDown to Arc Testnet and awaits confirmation
   */
  public async settleWheelsDown(
    flightId: Hex,
    airborneSeconds: bigint | number,
    fuelBurnKg: bigint | number,
    co2Kg: bigint | number,
    usdcAmount: bigint
  ): Promise<SettlementReceipt> {
    if (!this.walletClient || !this.walletClient.account) {
      throw new Error(
        "ArcSettler walletClient is not initialized with a signer account. Specify private key in CircleAgentWallet."
      );
    }

    const costUSDC = Number(usdcAmount) / 1_000_000;
    this.wallet.validateSpend(costUSDC);

    const data = this.encodeSettleWheelsDown(
      flightId,
      airborneSeconds,
      fuelBurnKg,
      co2Kg,
      usdcAmount
    );

    const txHash = await this.walletClient.sendTransaction({
      to: this.vaultAddress,
      data,
      chain: arcTestnet,
      account: this.walletClient.account,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Update spend tracking upon successful receipt
    this.wallet.recordSpend(costUSDC);

    return {
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      explorerUrl: this.getExplorerTxUrl(txHash),
    };
  }
}

/**
 * Top-level convenience function: registerFlightManifestOnArc
 */
export async function registerFlightManifestOnArc(
  callsign: string,
  category: string,
  treasury: Address,
  maxBudget: bigint,
  swapVmBytecode: Hex,
  options?: ArcSettlerConfig
): Promise<RegisterManifestResult> {
  const settler = new ArcSettler(options);
  return await settler.registerFlightManifest(
    callsign,
    category,
    treasury,
    maxBudget,
    swapVmBytecode
  );
}

/**
 * Top-level convenience function: settleWheelsDownOnArc
 */
export async function settleWheelsDownOnArc(
  flightId: Hex,
  airborneSeconds: bigint | number,
  fuelBurnKg: bigint | number,
  co2Kg: bigint | number,
  usdcAmount: bigint,
  options?: ArcSettlerConfig
): Promise<SettlementReceipt> {
  const settler = new ArcSettler(options);
  return await settler.settleWheelsDown(
    flightId,
    airborneSeconds,
    fuelBurnKg,
    co2Kg,
    usdcAmount
  );
}
