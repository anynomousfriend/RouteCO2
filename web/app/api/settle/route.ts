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
    stateMutability: "nonpayable",
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
      "0xeb20b11fabe61a00103c040e8febb7d12749e36d";

    const body = await request.json();
    const {
      callsign = "DLH400",
      aircraftCategory = "NARROW_BODY",
      airborneSeconds = 900,
      fuelBurnKg = 600,
      co2Kg = 1896,
      usdcAmount = 5000000n, // micro-USDC (6 decimals)
      treasuryAddress,
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

    // Register Flight Manifest on-chain first
    const budgetCap = 500_000_000n; // 500 USDC budget cap (in micro-units)
    const registerTxHash = await walletClient.writeContract({
      address: vaultAddress,
      abi: SKYROUTE_VAULT_ABI,
      functionName: "registerFlightManifest",
      args: [callsign, aircraftCategory, treasury, budgetCap],
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

    // Convert usdcAmount to BigInt
    const finalUsdcAmount = BigInt(usdcAmount);

    // Execute real settleWheelsDown transaction on Arc Testnet
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
    });

    const settleReceipt = await publicClient.waitForTransactionReceipt({
      hash: settleTxHash,
      confirmations: 1,
    });

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
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Settlement execution failed";
    console.error("[On-Chain Settlement Error]:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
