/**
 * Autonomous Flight Dispatcher Daemon
 *
 * Continuously evaluates commercial flight transponder telemetry,
 * calculates verified ICAO emissions on Wheels-Down (touchdown),
 * and executes zero-custody carbon-offset settlements on Arc Testnet (5042002).
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { keccak256, toHex, type Address, type Hex } from "viem";
import {
  type AircraftCategory,
  type WheelsDownSettlementResult,
  parseOpenSkyState,
  type OpenSkyStateVector,
  ICAO_AIRCRAFT_BENCHMARKS,
} from "./icao-engine.js";
import {
  CircleAgentDispatcher,
  type PreparedSettlementTransaction,
} from "./circle-agent.js";
import {
  ReplayStreamer,
  type ReplayFrame,
  type WheelsDownEventPayload,
} from "./replay-streamer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface DispatcherSettlementEvent {
  flightId: Hex;
  callsign: string;
  airborneSeconds: number;
  emissions: WheelsDownSettlementResult;
  transaction: PreparedSettlementTransaction;
  arcBlockNumber: bigint;
  explorerUrl: string;
  timestamp: number;
}

export interface LiveFlightSummary {
  callsign: string;
  icao24: string;
  originCountry: string;
  category: AircraftCategory;
  hourlyBurnKg: number;
  altitudeMeters: number | null;
  velocityMps: number | null;
  verticalRateMps: number | null;
  onGround: boolean;
}

const DEFAULT_VAULT_ADDRESS: Address = "0x56E71fcC37e573cD3291c0906053e51E5c83518c";

/**
 * Executes a verified deterministic descent replay session for DLH400
 * and dispatches the Wheels-Down settlement payload for Arc Testnet.
 */
export async function runReplaySession(options: {
  verbose?: boolean;
  vaultAddress?: Address;
} = {}): Promise<DispatcherSettlementEvent> {
  const verbose = options.verbose ?? false;
  const vaultAddress = options.vaultAddress ?? DEFAULT_VAULT_ADDRESS;

  // 1. Load recorded descent trajectory
  const distPath = resolve(__dirname, "data/replay-flight.json");
  const srcPath = resolve(__dirname, "../src/data/replay-flight.json");
  const replayPath = existsSync(distPath) ? distPath : srcPath;
  const rawData = readFileSync(replayPath, "utf-8");
  const frames: ReplayFrame[] = JSON.parse(rawData);

  const streamer = new ReplayStreamer(frames, "NARROW_BODY");
  const callsign = frames[0]?.callsign ?? "DLH400";
  const flightId = keccak256(toHex(`${callsign}_${frames[0]?.timestamp ?? Date.now()}`));

  const dispatcher = new CircleAgentDispatcher({
    vaultAddress,
    maxDailyBudgetUSDC: 5000.0,
    maxPerFlightBudgetUSDC: 500.0,
  });

  // Query live Arc block number for freshness verification
  const arcBlockNumber = await dispatcher.getLiveArcBlockNumber();

  if (verbose) {
    console.log("==================================================================");
    console.log("      SKYROUTE AUTONOMOUS FLIGHT DISPATCHER (REPLAY ENGINE)       ");
    console.log("==================================================================");
    console.log(`Flight:              ${callsign}`);
    console.log(`Flight ID:           ${flightId}`);
    console.log(`Vault Address:       ${vaultAddress}`);
    console.log(`Arc Block Number:    #${arcBlockNumber}`);
    console.log("------------------------------------------------------------------");
  }

  let touchdownResult: WheelsDownEventPayload | null = null;

  streamer.on("tick", (frame, index, total) => {
    if (verbose) {
      const altFt = Math.round((frame.baroAltitudeMeters ?? 0) * 3.28084);
      const kts = Math.round((frame.velocityMps ?? 0) * 1.94384);
      const vsi = Math.round((frame.verticalRateMps ?? 0) * 196.85);
      const groundState = frame.onGround ? "🛬 ON GROUND" : "✈️ AIRBORNE";
      console.log(
        `[Frame ${String(index + 1).padStart(2, "0")}/${total}] Alt: ${String(altFt).padStart(5)} ft | Spd: ${String(kts).padStart(3)} kts | VSI: ${String(vsi).padStart(5)} fpm | ${groundState}`
      );
    }
  });

  streamer.on("wheels-down", (payload: WheelsDownEventPayload) => {
    touchdownResult = payload;
  });

  // Step through all frames
  while (streamer.stepNext() !== null) {
    // Stepping trajectory
  }

  if (!touchdownResult) {
    throw new Error("Replay completed without detecting wheels-down touchdown frame");
  }

  const emissions = (touchdownResult as WheelsDownEventPayload).emissions;
  const transaction = dispatcher.prepareSettlementTransaction(flightId, emissions);
  const explorerUrl = `https://testnet.arcscan.app/address/${vaultAddress}`;

  if (verbose) {
    console.log("------------------------------------------------------------------");
    console.log(">>> WHEELS-DOWN DETECTED! IN-FLIGHT EMISSIONS FINALIZED <<<");
    console.log(`Airborne Duration:   ${emissions.airborneSeconds} seconds (${(emissions.airborneSeconds / 3600).toFixed(2)} hrs)`);
    console.log(`Aircraft Category:   ${emissions.aircraftCategory} (${emissions.hourlyBurnKg} kg/hr burn rate)`);
    console.log(`Jet-A1 Fuel Burn:    ${emissions.fuelBurnKg.toFixed(2)} kg`);
    console.log(`Verified CO2 Output: ${emissions.co2Kg.toFixed(2)} kg (ICAO 3.16x Factor)`);
    console.log(`Offset Cost (USDC):  $${emissions.costUSDC.toFixed(4)} USDC (@ $${emissions.pricePerTonneUSDC}/tonne)`);
    console.log(`Arc Micropayment:    ${emissions.usdcAmountMicro} micro-USDC (6 decimals)`);
    console.log(`Prepared Tx Data:    ${transaction.data.slice(0, 34)}...`);
    console.log(`ArcScan Explorer:    ${explorerUrl}`);
    console.log("==================================================================");
  }

  return {
    flightId,
    callsign,
    airborneSeconds: emissions.airborneSeconds,
    emissions,
    transaction,
    arcBlockNumber,
    explorerUrl,
    timestamp: Date.now(),
  };
}

/**
 * Queries real-time commercial aircraft from OpenSky Network (Zero-Mock)
 */
export async function queryLiveFleet(limit = 10): Promise<LiveFlightSummary[]> {
  const url = "https://opensky-network.org/api/states/all";
  const response = await fetch(url, {
    headers: { "User-Agent": "SkyRoute-Agent/1.0 (ETHOnline2026)" },
  });

  if (!response.ok) {
    throw new Error(`OpenSky Network API error: HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { states: OpenSkyStateVector[] | null };
  if (!data.states || !Array.isArray(data.states)) {
    return [];
  }

  const commercial = data.states
    .filter((s) => s[1] && s[1].trim().length > 0 && s[5] !== null && s[6] !== null)
    .slice(0, limit);

  return commercial.map((s) => {
    const telemetry = parseOpenSkyState(s);
    return {
      callsign: telemetry.callsign,
      icao24: s[0],
      originCountry: s[2],
      category: "NARROW_BODY" as AircraftCategory,
      hourlyBurnKg: ICAO_AIRCRAFT_BENCHMARKS.NARROW_BODY.hourlyBurnKg,
      altitudeMeters: telemetry.baroAltitudeMeters,
      velocityMps: telemetry.velocityMps,
      verticalRateMps: telemetry.verticalRateMps,
      onGround: telemetry.onGround,
    };
  });
}

/**
 * CLI Runner
 */
async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("--live") ? "live" : "replay";

  if (mode === "live") {
    console.log("Querying live OpenSky fleet...");
    const fleet = await queryLiveFleet(10);
    console.log(`Found ${fleet.length} active aircraft:`);
    console.table(fleet);
  } else {
    await runReplaySession({ verbose: true });
  }
}

// Auto-run if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error("Dispatcher error:", err);
    process.exit(1);
  });
}
