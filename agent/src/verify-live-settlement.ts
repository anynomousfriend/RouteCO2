/**
 * End-to-End Live Arc Testnet Settlement Verifier
 * 
 * Verifies live transaction broadcasting, SwapVM bytecode validation,
 * receipt confirmation, and on-chain carbon offset accumulation on ArcScan.
 */

import { type Hex, type Address } from "viem";
import { encodeAbiParameters, createWalletClient } from "viem";
import { ArcSettler } from "./arc-settler.js";
import { CircleAgentWallet } from "./circle-wallet.js";
import { compileSwapVMCurve } from "./swapvm-compiler.js";
import { arcTestnet } from "./circle-agent.js";
import { createPublicClient, http } from "viem";
import { SKYROUTE_VAULT_FULL_ABI } from "./arc-settler.js";
import { ARC_TESTNET_USDC_ADDRESS } from "./circle-developer-client.js";

async function main() {
  const rawKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.CIRCLE_AGENT_PRIVATE_KEY;
  if (!rawKey) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY / CIRCLE_AGENT_PRIVATE_KEY in environment");
  }
  const privateKey: Hex = rawKey.startsWith("0x") ? (rawKey as Hex) : (`0x${rawKey}` as Hex);
  const vaultAddress: Address =
    (process.env.NEXT_PUBLIC_ARC_VAULT_ADDRESS as Address) ||
    "0x469CA8E59ae25CBEEC2eA52617163E2396B9bdA1";

  console.log("==================================================================");
  console.log("       ROUTECO2 LIVE ARC TESTNET END-TO-END VERIFIER              ");
  console.log("==================================================================");
  console.log("Vault Address:   ", vaultAddress);
  console.log("Network:         Arc Testnet (Chain ID 5042002)");

  const wallet = new CircleAgentWallet({
    privateKey,
    allowedContracts: [vaultAddress],
    maxDailyBudgetUSDC: 5000,
    maxPerFlightBudgetUSDC: 1000,
  });

  const settler = new ArcSettler({
    wallet,
    vaultAddress,
  });

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http("https://rpc.testnet.arc.network"),
  });

  const agentAddress = wallet.getAddress();
  console.log("Agent Address:   ", agentAddress);

  // 1. Compile SwapVM Flight Fuel-Efficiency Bytecode
  const swapVmBytecode = compileSwapVMCurve({ includeDecay: true });
  console.log("SwapVM Bytecode: ", swapVmBytecode, "(Dynamic altitude cruise & descent curve)");

  // 2. Register Flight Manifest on Arc Testnet (faucet-safe demo amounts)
  const callsign = process.argv[2] || `LH${(Date.now() % 900) + 100}`;
  const maxBudget = 5_000_000n; // 5 USDC virtual Aqua allocation
  console.log(`\n>>> Step 1: Broadcasting registerFlightManifest for ${callsign}...`);

  const regResult = await settler.registerFlightManifest(
    callsign,
    "NARROW_BODY",
    agentAddress,
    maxBudget,
    swapVmBytecode
  );

  console.log("✅ Flight Manifest Registered!");
  console.log("   Flight ID:    ", regResult.flightId);
  console.log("   Tx Hash:      ", regResult.txHash);
  console.log("   Block Number: ", regResult.blockNumber.toString());
  console.log("   Gas Used:     ", regResult.gasUsed.toString());
  console.log("   ArcScan URL:  ", regResult.explorerUrl);

  // 2b. Ship the identical Aqua strategy directly from the treasury (real Aqua:
  // maker == treasury must ship) + approve Aqua for the real USDC pull.
  const aquaCore = process.env.NEXT_PUBLIC_AQUA_CORE_ADDRESS as Address | undefined;
  if (!aquaCore) throw new Error("Missing NEXT_PUBLIC_AQUA_CORE_ADDRESS for Aqua ship step");
  const usdcAddress = (process.env.NEXT_PUBLIC_USDC_ADDRESS || ARC_TESTNET_USDC_ADDRESS) as Address;
  const strategy = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }, { type: "bytes" }],
    [regResult.flightId, agentAddress, maxBudget, swapVmBytecode]
  );
  const account = wallet.getAccount();
  if (!account) throw new Error("Verifier requires a private-key wallet to ship the Aqua strategy");
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http("https://rpc.testnet.arc.network") });
  console.log("\n>>> Step 1b: Approving Aqua + shipping treasury strategy...");
  const approveHash = await walletClient.writeContract({
    address: usdcAddress,
    abi: [{ type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" }] as const,
    functionName: "approve",
    args: [aquaCore, maxBudget],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  try {
    const shipHash = await walletClient.writeContract({
      address: aquaCore,
      abi: [{ type: "function", name: "ship", inputs: [{ name: "app", type: "address" }, { name: "strategy", type: "bytes" }, { name: "tokens", type: "address[]" }, { name: "amounts", type: "uint256[]" }], outputs: [{ name: "strategyHash", type: "bytes32" }], stateMutability: "nonpayable" }] as const,
      functionName: "ship",
      args: [vaultAddress, strategy, [usdcAddress], [maxBudget]],
    });
    await publicClient.waitForTransactionReceipt({ hash: shipHash });
    console.log("✅ Aqua strategy shipped (treasury retains custody).");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/immutable/i.test(msg)) throw err;
    console.log("✅ Aqua strategy already shipped (immutable reuse).");
  }

  // 3. Settle Wheels-Down Carbon Offset (small demo tranche)
  const airborneSeconds = 900; // 15-minute demo leg
  const fuelBurnKg = 40;       // 40 kg Jet-A1
  const co2Kg = 126;           // 40 * 3.16 = ~126 kg CO2
  const offsetCostMicroUSDC = 3_150_000n; // $3.15 USDC (@ $25/tonne)

  console.log(`\n>>> Step 2: Broadcasting settleWheelsDown (${co2Kg} kg CO2)...`);
  const settleResult = await settler.settleWheelsDown(
    regResult.flightId,
    airborneSeconds,
    fuelBurnKg,
    co2Kg,
    offsetCostMicroUSDC
  );

  console.log("✅ Wheels-Down Carbon Offset Settled!");
  console.log("   Tx Hash:      ", settleResult.txHash);
  console.log("   Block Number: ", settleResult.blockNumber.toString());
  console.log("   Gas Used:     ", settleResult.gasUsed.toString());
  console.log("   ArcScan URL:  ", settleResult.explorerUrl);

  // 4. Verify Cumulative Certified Carbon Credits on Arc
  const credits = await publicClient.readContract({
    address: vaultAddress,
    abi: SKYROUTE_VAULT_FULL_ABI,
    functionName: "totalCarbonOffsetKg",
    args: [agentAddress],
  });

  console.log("\n==================================================================");
  console.log("VERIFIED ON-CHAIN RETIRED CARBON CREDITS:");
  console.log(`Airline Treasury: ${agentAddress}`);
  console.log(`Total Retired CO2: ${credits.toString()} kg`);
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
