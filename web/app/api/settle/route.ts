import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  keccak256,
  encodePacked,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Arc Testnet Chain Definition (Chain ID 5042002)
const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

const SKYROUTE_VAULT_ABI = [
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
    name: "totalCarbonOffsetKg",
    inputs: [{ name: "treasury", type: "address" }],
    outputs: [{ name: "offsetKg", type: "uint256" }],
    stateMutability: "view",
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
      { name: "settled", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "authorizedAgents",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "authorized", type: "bool" }],
    stateMutability: "view",
  },
] as const;

export async function POST(request: NextRequest) {
  try {
    const rawKey =
      process.env.DEPLOYER_PRIVATE_KEY ||
      process.env.CIRCLE_AGENT_PRIVATE_KEY;

    if (!rawKey) {
      return NextResponse.json(
        {
          error:
            "Missing DEPLOYER_PRIVATE_KEY / CIRCLE_AGENT_PRIVATE_KEY in server environment.",
        },
        { status: 500 }
      );
    }

    const privateKey: Hex = rawKey.startsWith("0x")
      ? (rawKey as Hex)
      : (`0x${rawKey}` as Hex);

    const vaultAddress: Address =
      (process.env.NEXT_PUBLIC_ARC_VAULT_ADDRESS as Address) ||
      (process.env.NEXT_PUBLIC_SKYROUTE_VAULT_ADDRESS as Address) ||
      "0xb579e26C81FDf858a9A6a0F3CcAB497a70343c5d";

    const body = await request.json();
    const {
      callsign = "DLH400",
      aircraftCategory = "NARROW_BODY",
      airborneSeconds = 900,
      fuelBurnKg = 600,
      co2Kg = 1896,
      usdcAmount = 5000000n, // micro-USDC (6 decimals)
      treasuryAddress,
      swapVmBytecode = "0x010203",
    } = body;

    const account = privateKeyToAccount(privateKey);

    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http("https://rpc.testnet.arc.network", {
        retryCount: 3,
        retryDelay: 1000,
        timeout: 15_000,
      }),
    });

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http("https://rpc.testnet.arc.network"),
    });

    // Check agent authorization
    const isAuthorized = await publicClient.readContract({
      address: vaultAddress,
      abi: SKYROUTE_VAULT_ABI,
      functionName: "authorizedAgents",
      args: [account.address],
    });

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error: `Agent address ${account.address} is not authorized on SkyRouteVault (${vaultAddress}).`,
        },
        { status: 403 }
      );
    }

    const treasury: Address = (treasuryAddress as Address) || account.address;
    const finalUsdcAmount = BigInt(usdcAmount);

    // Register Flight Manifest on-chain first (dynamic budget cap with 2x buffer)
    const budgetCap =
      finalUsdcAmount > 250_000_000n
        ? finalUsdcAmount * 2n
        : 500_000_000n; // At least 500 USDC
    const registerTxHash = await walletClient.writeContract({
      address: vaultAddress,
      abi: SKYROUTE_VAULT_ABI,
      functionName: "registerFlightManifest",
      args: [
        callsign,
        aircraftCategory,
        treasury,
        budgetCap,
        (swapVmBytecode as Hex) || "0x010203",
      ],
    });

    const registerReceipt = await publicClient.waitForTransactionReceipt({
      hash: registerTxHash,
      confirmations: 1,
    });

    // The flightId is emitted in event or computed deterministically: keccak256(abi.encodePacked(callsign, treasury, block.timestamp))
    let flightId: Hex;
    if (registerReceipt.logs && registerReceipt.logs.length > 0 && registerReceipt.logs[0].topics[1]) {
      flightId = registerReceipt.logs[0].topics[1] as Hex;
    } else {
      const block = await publicClient.getBlock({ blockHash: registerReceipt.blockHash });
      flightId = keccak256(
        encodePacked(
          ["string", "address", "uint256"],
          [callsign, treasury, block.timestamp]
        )
      );
    }

    // 1:1,000 Testnet Demo Scaling:
    // Full valuation is finalUsdcAmount (in 6-decimal micro-USDC).
    // On Arc Testnet, the native currency is USDC (18-decimal wei).
    // Converting (finalUsdcAmount / 1000) into 18-decimal wei: (finalUsdcAmount * 10^12) / 1000 = finalUsdcAmount * 10^9.
    const scaledNativeValue =
      finalUsdcAmount > 0n
        ? finalUsdcAmount * 1_000_000_000n
        : 10_000_000_000_000_000n; // Default to 0.01 native USDC if 0

    // Execute real settleWheelsDown transaction on Arc Testnet with scaled native USDC payment
    const settleTxHash = await walletClient.writeContract({
      address: vaultAddress,
      abi: SKYROUTE_VAULT_ABI,
      functionName: "settleWheelsDown",
      args: [
        flightId,
        BigInt(Math.floor(airborneSeconds)),
        BigInt(Math.floor(fuelBurnKg)),
        BigInt(Math.floor(co2Kg)),
        finalUsdcAmount,
      ],
      value: scaledNativeValue,
    });

    const settleReceipt = await publicClient.waitForTransactionReceipt({
      hash: settleTxHash,
      confirmations: 1,
    });

    // Query verified on-chain total carbon credits for the treasury
    let totalCarbonOffsetKg = "0";
    try {
      const credits = await publicClient.readContract({
        address: vaultAddress,
        abi: SKYROUTE_VAULT_ABI,
        functionName: "totalCarbonOffsetKg",
        args: [treasury],
      });
      totalCarbonOffsetKg = (credits as bigint).toString();
    } catch (err) {
      throw new Error(
        "Failed to read verified on-chain carbon credits: " +
          (err instanceof Error ? err.message : String(err))
      );
    }

    const scaledCostUSDC = (Number(scaledNativeValue) / 1e18).toFixed(4);
    const fullCostUSDC = (Number(finalUsdcAmount) / 1e6).toFixed(2);

    return NextResponse.json({
      success: true,
      flightId,
      callsign,
      registerTxHash,
      settleTxHash,
      blockNumber: Number(settleReceipt.blockNumber),
      gasUsed: settleReceipt.gasUsed.toString(),
      explorerUrl: `https://testnet.arcscan.app/tx/${settleTxHash}`,
      agentAddress: account.address,
      treasuryAddress: treasury,
      scaledCostUSDC,
      fullCostUSDC,
      totalCarbonOffsetKg,
      scalingRatio: "1:1,000",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Settlement execution failed";
    console.error("[On-Chain Settlement Error]:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
