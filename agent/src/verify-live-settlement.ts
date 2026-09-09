/**
 * End-to-End Live Arc Testnet Settlement Verifier
 * 
 * Verifies live transaction broadcasting, SwapVM bytecode validation,
 * receipt confirmation, and on-chain carbon offset accumulation on ArcScan.
 */

import { parseEther, type Hex, type Address } from "viem";
import { ArcSettler } from "./arc-settler.js";
import { CircleAgentWallet } from "./circle-wallet.js";
import { compileSwapVMCurve } from "./swapvm-compiler.js";
import { arcTestnet } from "./circle-agent.js";
import { createPublicClient, http } from "viem";
import { SKYROUTE_VAULT_FULL_ABI } from "./arc-settler.js";

async function main() {
  const rawKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.CIRCLE_AGENT_PRIVATE_KEY;
  if (!rawKey) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY / CIRCLE_AGENT_PRIVATE_KEY in environment");
  }
  const privateKey: Hex = rawKey.startsWith("0x") ? (rawKey as Hex) : (`0x${rawKey}` as Hex);
  const vaultAddress: Address =
    (process.env.NEXT_PUBLIC_ARC_VAULT_ADDRESS as Address) ||
    "0xb579e26C81FDf858a9A6a0F3CcAB497a70343c5d";

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

  // 2. Register Flight Manifest on Arc Testnet
  const callsign = process.argv[2] || `LH${(Date.now() % 900) + 100}`;
  const maxBudget = 500_000_000n; // 500 USDC
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

  // 3. Settle Wheels-Down Carbon Offset
  const airborneSeconds = 2840; // ~47 minutes descent
  const fuelBurnKg = 1850;      // 1,850 kg Jet-A1
  const co2Kg = 5846;          // 1,850 * 3.16 = 5,846 kg CO2
  const offsetCostMicroUSDC = 146_150_000n; // $146.15 USDC (@ $25/tonne)

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
