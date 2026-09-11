import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  http,
  keccak256,
  encodePacked,
  encodeAbiParameters,
  type Address,
  type Hex,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  arcTestnet,
  SKYROUTE_VAULT_ABI,
  publicArcClient,
} from "@/lib/arc-client";
import {
  agentWalletExecute,
  circleAgentWalletAddress,
  extractAgentTxHash,
  isCircleTimeout,
  recoverRegisterFromLogs,
  recoverSettleFromLogs,
  weiToDecimalString,
} from "@/lib/circle-agent-wallet";

export const dynamic = "force-dynamic";

// Track 2 (Agent Stack): the autonomous signer is the Circle Agent Wallet
// (ARC-TESTNET, owner-authorized on SkyRouteVault). The server EOA key is used
// ONLY for the treasury ship step when the treasury is the server treasury
// (maker ships its own Aqua strategy) — never as a settlement fallback.
const SERVER_TREASURY_DEFAULT = "0x1698fdA3A9A8Ca9530434e545986176579F01650";

export async function POST(request: NextRequest) {
  try {
    const agentWallet = circleAgentWalletAddress() as Address;
    const vaultAddress: Address =
      (process.env.NEXT_PUBLIC_ARC_VAULT_ADDRESS as Address) ||
      (process.env.NEXT_PUBLIC_SKYROUTE_VAULT_ADDRESS as Address) ||
      "0xe6bbB15BA58E46Cd02Cfa4B842A9e3Dc3a66b57F";

    // 0. The Agent Wallet must be an owner-authorized agent on the vault.
    const isAuthorized = await publicArcClient.readContract({
      address: vaultAddress,
      abi: SKYROUTE_VAULT_ABI,
      functionName: "authorizedAgents",
      args: [agentWallet],
    });

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error: `Circle Agent Wallet ${agentWallet} is not authorized on SkyRouteVault (${vaultAddress}). Ask the vault owner to call setAuthorizedAgent first.`,
        },
        { status: 403 }
      );
    }

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

    const serverTreasury = (process.env.SERVER_TREASURY_ADDRESS ||
      SERVER_TREASURY_DEFAULT) as Address;
    const treasury: Address = (treasuryAddress as Address) || serverTreasury;
    // Demo-scale execution (authoritative here, so direct POSTs can't bypass
    // it): wire format stays full-economics micro-USDC; the chain pulls the
    // scaled amount. See lib/demo-scale.ts (default 1:1000, "1" = full value).
    const { scaleUsdcMicro, demoScaleLabel } = await import("@/lib/demo-scale");
    const finalUsdcAmount = scaleUsdcMicro(BigInt(usdcAmount));
    const finalBytecode = ((swapVmBytecode as Hex) || "0x010203") as Hex;

    // Register Flight Manifest on-chain first via the Agent Wallet
    // (dynamic budget cap with 2x buffer). The wallet becomes registrar.
    // Slow-relayer note: Circle's testnet poller often reports TIMEOUT after
    // the tx already lands on Arc — on timeout we recover (flightId, txHash)
    // from chain logs instead of failing the settlement.
    const budgetCap =
      finalUsdcAmount > 250_000_000n
        ? finalUsdcAmount * 2n
        : 500_000_000n; // At least 500 USDC
    const startBlock = await publicArcClient.getBlockNumber();
    let registerTxHash: string;
    let flightId: Hex;
    try {
      const registerPayload = await agentWalletExecute({
        signature: "registerFlightManifest(string,string,address,uint256,bytes)",
        abiParams: [callsign, aircraftCategory, treasury, budgetCap.toString(), finalBytecode],
        contract: vaultAddress,
      });
      registerTxHash = extractAgentTxHash(registerPayload);

      const registerReceipt = await publicArcClient.waitForTransactionReceipt({
        hash: registerTxHash as Hash,
        confirmations: 1,
      });

      // The flightId is emitted in event or computed deterministically: keccak256(abi.encodePacked(callsign, treasury, block.timestamp))
      if (registerReceipt.logs && registerReceipt.logs.length > 0 && registerReceipt.logs[0].topics[1]) {
        flightId = registerReceipt.logs[0].topics[1] as Hex;
      } else {
        const block = await publicArcClient.getBlock({ blockHash: registerReceipt.blockHash });
        flightId = keccak256(
          encodePacked(
            ["string", "address", "uint256"],
            [callsign, treasury, block.timestamp]
          )
        );
      }
    } catch (err) {
      if (!isCircleTimeout(err)) throw err;
      const recovered = await recoverRegisterFromLogs({
        publicClient: publicArcClient,
        vault: vaultAddress,
        callsign,
        treasury,
        fromBlock: startBlock,
      });
      if (!recovered) {
        throw new Error(
          "Circle Agent Wallet timed out AND no register event found on-chain after 4 minutes. " +
            (err instanceof Error ? err.message : String(err))
        );
      }
      registerTxHash = recovered.txHash;
      flightId = recovered.flightId as Hex;
    }

    // Real Aqua strategy ship (1inch Aqua semantics: maker == treasury must ship directly).
    // Strategy bytes must EXACTLY match SkyRouteVault: abi.encode(flightId, treasury, budgetCap, bytecode).
    // When the treasury is the server treasury, the server key ships + approves here.
    // Otherwise fail loudly: the external treasury must ship + approve before settle (no mock).
    const aquaAddress = (process.env.NEXT_PUBLIC_AQUA_CORE_ADDRESS as Address) || undefined;
    const usdcAddress = (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address) || undefined;
    if (treasury.toLowerCase() === serverTreasury.toLowerCase()) {
      const rawKey =
        process.env.DEPLOYER_PRIVATE_KEY ||
        process.env.CIRCLE_AGENT_PRIVATE_KEY;
      if (!rawKey) {
        throw new Error(
          "Server-treasury Aqua ship needs DEPLOYER_PRIVATE_KEY / CIRCLE_AGENT_PRIVATE_KEY in server environment."
        );
      }
      const privateKey: Hex = rawKey.startsWith("0x")
        ? (rawKey as Hex)
        : (`0x${rawKey}` as Hex);
      const account = privateKeyToAccount(privateKey);
      if (!aquaAddress || !usdcAddress) {
        throw new Error(
          "Missing NEXT_PUBLIC_AQUA_CORE_ADDRESS / NEXT_PUBLIC_USDC_ADDRESS: cannot ship Aqua strategy for treasury settlement."
        );
      }
      const walletClient = createWalletClient({
        account,
        chain: arcTestnet,
        transport: http("https://rpc.testnet.arc.network"),
      });
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
      await publicArcClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
      try {
        const shipHash = await walletClient.writeContract({
          address: aquaAddress,
          abi: AQUA_SHIP_ABI,
          functionName: "ship",
          args: [vaultAddress, strategy, [usdcAddress], [budgetCap]],
        });
        await publicArcClient.waitForTransactionReceipt({ hash: shipHash, confirmations: 1 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/immutable/i.test(msg)) throw err;
      }
    }

    // Demo scaling, documented explicitly:
    // finalUsdcAmount is the EXECUTED on-chain pull (6-decimal micro-USDC),
    // already divided by the demo divisor in lib/demo-scale.ts (default 1:1000).
    // settleWheelsDown pulls exactly finalUsdcAmount via Aqua.pull (real ERC20).
    // scaledNativeValue is an additional native msg.value demo contribution
    // alongside the pull, NOT the settlement amount itself.
    const scaledNativeValue =
      finalUsdcAmount > 0n
        ? finalUsdcAmount * 1_000_000_000n
        : 10_000_000_000_000_000n; // Default to 0.01 native USDC if 0

    // Preflight the exact agent settle (free): an unshipped external-treasury
    // strategy fails here with the real revert reason instead of burning gas.
    const settleArgs = [
      flightId,
      BigInt(Math.floor(airborneSeconds)),
      BigInt(Math.floor(fuelBurnKg)),
      BigInt(Math.floor(co2Kg)),
      finalUsdcAmount,
    ] as const;
    try {
      await publicArcClient.simulateContract({
        address: vaultAddress,
        abi: SKYROUTE_VAULT_ABI,
        functionName: "settleWheelsDown",
        args: settleArgs,
        account: agentWallet,
        value: scaledNativeValue,
      });
    } catch (err) {
      throw new Error(
        `Agent settle preflight reverted (treasury ${treasury} likely never shipped + approved the Aqua strategy): ` +
          (err instanceof Error ? err.message : String(err))
      );
    }

    // Execute real settleWheelsDown from the Circle Agent Wallet with scaled native USDC payment.
    // Same slow-relayer recovery: on CLI TIMEOUT, confirm via the indexed
    // WheelsDownSettled event instead of failing.
    const settleBlock = await publicArcClient.getBlockNumber();
    let settleTxHash: string;
    try {
      const settlePayload = await agentWalletExecute({
        signature: "settleWheelsDown(bytes32,uint256,uint256,uint256,uint256)",
        abiParams: [
          flightId,
          BigInt(Math.floor(airborneSeconds)).toString(),
          BigInt(Math.floor(fuelBurnKg)).toString(),
          BigInt(Math.floor(co2Kg)).toString(),
          finalUsdcAmount.toString(),
        ],
        contract: vaultAddress,
        value: weiToDecimalString(scaledNativeValue),
      });
      settleTxHash = extractAgentTxHash(settlePayload);
    } catch (err) {
      if (!isCircleTimeout(err)) throw err;
      const recoveredTx = await recoverSettleFromLogs({
        publicClient: publicArcClient,
        vault: vaultAddress,
        flightId,
        fromBlock: settleBlock,
      });
      if (!recoveredTx) {
        throw new Error(
          "Circle Agent Wallet timed out AND no settle event found on-chain after 4 minutes. " +
            (err instanceof Error ? err.message : String(err))
        );
      }
      settleTxHash = recoveredTx;
    }

    const settleReceipt = await publicArcClient.waitForTransactionReceipt({
      hash: settleTxHash as Hash,
      confirmations: 1,
    });

    // Query verified on-chain total carbon credits for the treasury
    let totalCarbonOffsetKg = "0";
    try {
      const credits = await publicArcClient.readContract({
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
    // Executed ERC20 pull (what the chain actually moved), post demo-scale.
    const executedCostUSDC = (Number(finalUsdcAmount) / 1e6).toFixed(2);

    return NextResponse.json({
      success: true,
      flightId,
      callsign,
      registerTxHash,
      settleTxHash,
      blockNumber: Number(settleReceipt.blockNumber),
      gasUsed: settleReceipt.gasUsed.toString(),
      explorerUrl: `https://testnet.arcscan.app/tx/${settleTxHash}`,
      agentAddress: agentWallet,
      treasuryAddress: treasury,
      scaledCostUSDC,
      executedCostUSDC,
      totalCarbonOffsetKg,
      scalingRatio: demoScaleLabel(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Settlement execution failed";
    console.error("[On-Chain Settlement Error]:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
