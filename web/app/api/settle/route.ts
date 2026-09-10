import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  http,
  keccak256,
  encodePacked,
  encodeAbiParameters,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  arcTestnet,
  SKYROUTE_VAULT_ABI,
  publicArcClient,
} from "@/lib/arc-client";

export const dynamic = "force-dynamic";

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
      "0x469CA8E59ae25CBEEC2eA52617163E2396B9bdA1";

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

    const publicClient = publicArcClient;

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

    // Real Aqua strategy ship (1inch Aqua semantics: maker == treasury must ship directly).
    // Strategy bytes must EXACTLY match SkyRouteVault: abi.encode(flightId, treasury, budgetCap, bytecode).
    // When the server key IS the treasury (default demo flow), ship + approve Aqua here.
    // Otherwise fail loudly — the external treasury must ship + approve before settle (no mock).
    const aquaAddress = (process.env.NEXT_PUBLIC_AQUA_CORE_ADDRESS as Address) || undefined;
    const usdcAddress = (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address) || undefined;
    const finalBytecode = ((swapVmBytecode as Hex) || "0x010203") as Hex;
    if (treasury.toLowerCase() === account.address.toLowerCase()) {
      if (!aquaAddress || !usdcAddress) {
        throw new Error(
          "Missing NEXT_PUBLIC_AQUA_CORE_ADDRESS / NEXT_PUBLIC_USDC_ADDRESS: cannot ship Aqua strategy for treasury settlement."
        );
      }
      const strategy = encodeAbiParameters(
        [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }, { type: "bytes" }],
        [flightId, treasury, budgetCap, finalBytecode]
      );
      const AQUA_SHIP_ABI = [
        {
          type: "function",
          name: "ship",
          inputs: [
            { name: "app", type: "address" },
            { name: "strategy", type: "bytes" },
            { name: "tokens", type: "address[]" },
            { name: "amounts", type: "uint256[]" },
          ],
          outputs: [{ name: "strategyHash", type: "bytes32" }],
          stateMutability: "nonpayable",
        },
      ] as const;
      const ERC20_APPROVE_ABI = [
        {
          type: "function",
          name: "approve",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
        },
      ] as const;
      // Approve Aqua to pull real USDC, then ship virtual liquidity (wait for receipts:
      // settleWheelsDown reverts unless the strategy is mined before it executes)
      const approveHash = await walletClient.writeContract({
        address: usdcAddress,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [aquaAddress, budgetCap],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
      try {
        const shipHash = await walletClient.writeContract({
          address: aquaAddress,
          abi: AQUA_SHIP_ABI,
          functionName: "ship",
          args: [vaultAddress, strategy, [usdcAddress], [budgetCap]],
        });
        await publicClient.waitForTransactionReceipt({ hash: shipHash, confirmations: 1 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/immutable/i.test(msg)) throw err;
      }
    }

    // Demo scaling, documented explicitly:
    // Full carbon valuation is finalUsdcAmount in 6-decimal micro-USDC (Arc Testnet USDC ERC-20
    // 0x3600...0000 has 6 decimals; native gas is also USDC). settleWheelsDown pulls the FULL
    // finalUsdcAmount via Aqua.pull (real ERC20). scaledNativeValue is an additional 1:1000
    // native msg.value demo contribution, NOT the settlement amount itself.
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
