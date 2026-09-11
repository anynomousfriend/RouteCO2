/**
 * One-shot live end-to-end settlement via the Circle Agent Wallet on Arc Testnet.
 *
 * Proven architecture: the Agent Wallet registers + settles; the treasury holder
 * ships + approves the Aqua strategy separately (Circle CLI v1 cannot encode the
 * `address[]` calldata that `ship()` needs). This script settles a manifest whose
 * strategy the treasury already shipped — the settle preflight fails fast with the
 * real revert reason otherwise.
 *
 *   TREASURY=0x... RUN_AGENT_SETTLEMENT_LIVE=1 node dist/run-agent-wallet-settlement.js
 *
 * The RUN_AGENT_SETTLEMENT_LIVE=1 gate exists so builds, tests, and daemon starts
 * can never broadcast accidentally. Requires `circle wallet login --testnet`.
 */
import {
  isAgentAuthorizedOnVault,
  settleFlightViaAgentWallet,
  SKYROUTE_VAULT_ADDRESS,
} from "./agent-wallet-settler.js";
import { agentWalletAddress } from "./circle-cli-agent.js";

async function main() {
  if (process.env.RUN_AGENT_SETTLEMENT_LIVE !== "1") {
    throw new Error(
      "Refusing to broadcast: set RUN_AGENT_SETTLEMENT_LIVE=1 to run this live settlement explicitly."
    );
  }
  const wallet = agentWalletAddress();
  const vault = SKYROUTE_VAULT_ADDRESS;
  const treasury =
    process.env.TREASURY || "0x1698fdA3A9A8Ca9530434e545986176579F01650";
  console.log("Agent Wallet: ", wallet);
  console.log("Vault:        ", vault);
  console.log("Treasury:     ", treasury);

  const authorized = await isAgentAuthorizedOnVault(wallet);
  console.log("Authorized:   ", authorized);
  if (!authorized) {
    throw new Error(
      `Agent wallet ${wallet} is not an authorized agent on SkyRouteVault (${vault}). ` +
        `Ask the vault owner to call setAuthorizedAgent(${wallet}, true).`
    );
  }

  const result = await settleFlightViaAgentWallet({
    callsign: process.env.CALLSIGN || "AGENTW3",
    aircraftCategory: "NARROW_BODY",
    airborneSeconds: 900,
    fuelBurnKg: 600,
    co2Kg: 1896,
    usdcMicro: 100_000n, // 0.10 USDC demo tranche
    treasury,
    policy: {
      allowedContracts: [vault],
      maxPerFlightUSDC: 5,
      maxDailyUSDC: 50,
      spentTodayUSDC: 0,
    },
    allowedContracts: [vault],
  });

  console.log("flightId:        ", result.flightId);
  console.log("registerTxHash:  ", result.registerTxHash);
  console.log("settleTxHash:    ", result.settleTxHash);
  console.log("blockNumber:     ", result.blockNumber);
  console.log("explorerUrl:     ", result.explorerUrl);
  console.log("totalCarbonKg:   ", result.totalCarbonOffsetKg);
}

main().catch((err) => {
  console.error("LIVE AGENT SETTLEMENT FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
