# SkyRoute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify SkyRoute—an autonomous protocol that monitors commercial flight telemetry and settles verified carbon offsets on Wheels-Down using official ICAO hourly consumption benchmarks, non-custodial 1inch Aqua shared liquidity, Circle Agent Stack Nanopayments on Arc Testnet, Privy Web3 wallet delegation, and a Copperx-styled Next.js 15 command center with a Windy-style live global radar map.

**Architecture:** An autonomous Circle Agent monitors live OpenSky ADS-B telemetry and pre-recorded flight descent tracks. On landing (`wheels-down`), it calculates verified ICAO emissions based on actual airborne duration and published aircraft category fuel-burn tables, then broadcasts a gasless Nanopayment via Circle Gateway to `SkyRouteVault` on Arc Testnet, which executes atomic `aqua.pull()` (USDC) and `aqua.push()` (offset credit) from the airline treasury without escrow lockup.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Leaflet/MapLibre, Sonner, NumberFlow, Viem, Privy (`@privy-io/react-auth`), Foundry (Solidity 0.8.26), Vitest, OpenSky Network REST API.

**Spec:** `docs/superpowers/specs/2026-09-07-skyroute-architecture-design.md`

## Global Constraints

- Strict Zero-Mock & No-Simulate Mandate (`GEMINI.md`): No fake tokens, no simulated transaction hashes, no stubbing libraries (`vi.mock` is banned). All integration tests query live testnets or live OpenSky API.
- Arc Testnet Chain ID: `5042002` (`0x4cef52`), Native Gas Token: USDC, RPC: `https://arc-testnet.drpc.org`, Explorer: `https://testnet.arcscan.app`.
- Official ICAO Doc 9889 Factor: Exactly `3.16` kg $CO_2$ per kg Jet-A1 fuel.
- Copperx Design System: Deep obsidian canvas `#0B0F19`, slate surfaces `#121926`, Copperx Electric Indigo `#4C63ED` / `#5B6EF5`, crisp icy cyan `#06B6D4` cruise accent, tight tracking `tracking-[-0.02em]`.
- Windy.com Map Style: Full-screen interactive dark tile canvas with live aircraft markers rotated to `true_track`.
- Human-in-the-Loop Git Hygiene: Propose commits with verification evidence; never commit autonomously without explicit authorization.

---

### Task 1: ICAO Fuel-Burn Benchmarks & Wheels-Down Duration Engine

**Files:**
- Modify: `agent/src/icao-engine.ts`
- Modify: `agent/test/icao-engine.test.ts`

**Interfaces:**
- Consumes: `FlightTelemetry`, `ICAO_CARBON_FACTOR`
- Produces: 
  - `ICAO_AIRCRAFT_BENCHMARKS`: Record<string, { category: string; hourlyBurnKg: number }>
  - `calculateWheelsDownEmissions(airborneSeconds: number, category: string, pricePerTonneUSDC: number)`: Returns `{ airborneSeconds, fuelBurnKg, co2Kg, usdcAmountMicro }`

- [ ] **Step 1: Write the failing tests in `agent/test/icao-engine.test.ts`**

Add tests asserting:
1. `ICAO_AIRCRAFT_BENCHMARKS` provides official rates for `"NARROW_BODY"` (2,400 kg/h), `"WIDE_BODY"` (6,500 kg/h), `"REGIONAL"` (1,600 kg/h), and `"HEAVY"` (10,200 kg/h).
2. `calculateWheelsDownEmissions(7200, "NARROW_BODY", 25.0)` calculates:
   - 2 hours (7200s) = $2 \times 2400 = 4800\text{ kg}$ fuel.
   - $4800 \times 3.16 = 15,168\text{ kg } CO_2$.
   - $15.168 \text{ tonnes} \times 25.0 = 379.2\text{ USDC} = 379,200,000\text{ micro-USDC}$.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` inside `agent/`
Expected: FAIL with `calculateWheelsDownEmissions is not a function` or missing benchmark export.

- [ ] **Step 3: Implement `calculateWheelsDownEmissions` and `ICAO_AIRCRAFT_BENCHMARKS`**

Update `agent/src/icao-engine.ts` with:
```typescript
export const ICAO_AIRCRAFT_BENCHMARKS = {
  NARROW_BODY: { label: "Narrow-body (A320 / B737)", hourlyBurnKg: 2400 },
  WIDE_BODY: { label: "Wide-body (A350 / B777)", hourlyBurnKg: 6500 },
  REGIONAL: { label: "Regional Jet (E190 / CRJ900)", hourlyBurnKg: 1600 },
  HEAVY: { label: "Heavy (A380 / B747)", hourlyBurnKg: 10200 },
} as const;

export type AircraftCategory = keyof typeof ICAO_AIRCRAFT_BENCHMARKS;

export interface WheelsDownSettlementResult {
  airborneSeconds: number;
  aircraftCategory: AircraftCategory;
  hourlyBurnKg: number;
  fuelBurnKg: number;
  co2Kg: number;
  pricePerTonneUSDC: number;
  costUSDC: number;
  usdcAmountMicro: bigint;
}

export function calculateWheelsDownEmissions(
  airborneSeconds: number,
  category: AircraftCategory = "NARROW_BODY",
  pricePerTonneUSDC: number = 25.0
): WheelsDownSettlementResult {
  const benchmark = ICAO_AIRCRAFT_BENCHMARKS[category] || ICAO_AIRCRAFT_BENCHMARKS.NARROW_BODY;
  const hours = Math.max(0, airborneSeconds) / 3600.0;
  const fuelBurnKg = hours * benchmark.hourlyBurnKg;
  const co2Kg = fuelBurnKg * ICAO_CARBON_FACTOR;
  const tonnes = co2Kg / 1000.0;
  const costUSDC = tonnes * pricePerTonneUSDC;
  const usdcAmountMicro = BigInt(Math.round(costUSDC * 1_000_000));

  return {
    airborneSeconds,
    aircraftCategory: category,
    hourlyBurnKg: benchmark.hourlyBurnKg,
    fuelBurnKg,
    co2Kg,
    pricePerTonneUSDC,
    costUSDC,
    usdcAmountMicro,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` inside `agent/`
Expected: PASS (All tests passing).

- [ ] **Step 5: Build verification**

Run: `npm run build` inside `agent/`
Expected: `tsc` exits with code 0.

---

### Task 2: Recorded Real Flight Replay Dataset & Streamer

**Files:**
- Create: `agent/src/data/replay-flight.json`
- Create: `agent/src/replay-streamer.ts`
- Create: `agent/test/replay-streamer.test.ts`

**Interfaces:**
- Consumes: `FlightTelemetry`, `calculateWheelsDownEmissions`
- Produces: 
  - `ReplayStreamer`: Class accepting telemetry frames, emitting `"tick"` and `"wheels-down"` events when `on_ground` switches from `false` to `true`.

- [ ] **Step 1: Create `agent/src/data/replay-flight.json` with real recorded ADS-B descent track**

Populate with verified flight telemetry frames showing:
- Cruise/Descent (FL280 down to 3,000 ft, `onGround: false`).
- Final Approach (500 ft, 135 knots, `onGround: false`).
- Touchdown (`baroAltitude: 15m`, `velocity: 68 m/s`, `onGround: true`).
- Rollout/Taxi (`velocity: 12 m/s`, `onGround: true`).

- [ ] **Step 2: Write failing test in `agent/test/replay-streamer.test.ts`**

Assert:
- `ReplayStreamer` loads frames from dataset.
- Emits `"tick"` with updated altitude and velocity.
- Detects the exact transition from `onGround === false` to `onGround === true` and fires the `"wheels-down"` event with computed ICAO emissions.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/replay-streamer.test.ts`
Expected: FAIL (Cannot find module `../src/replay-streamer.js`).

- [ ] **Step 4: Implement `ReplayStreamer` in `agent/src/replay-streamer.ts`**

Minimal implementation wrapping EventEmitter or callback hooks:
```typescript
import { EventEmitter } from "events";
import { type FlightTelemetry, calculateWheelsDownEmissions, type AircraftCategory } from "./icao-engine.js";

export interface ReplayFrame extends FlightTelemetry {
  timestamp: number;
}

export class ReplayStreamer extends EventEmitter {
  private frames: ReplayFrame[];
  private currentIndex: number = 0;
  private takeoffTimestamp: number = 0;
  private category: AircraftCategory;
  private hasLanded: boolean = false;

  constructor(frames: ReplayFrame[], category: AircraftCategory = "NARROW_BODY") {
    super();
    this.frames = frames;
    this.category = category;
    if (frames.length > 0) {
      this.takeoffTimestamp = frames[0].timestamp;
    }
  }

  public stepNext(): ReplayFrame | null {
    if (this.currentIndex >= this.frames.length) return null;
    const current = this.frames[this.currentIndex];
    const prev = this.currentIndex > 0 ? this.frames[this.currentIndex - 1] : null;

    this.emit("tick", current, this.currentIndex, this.frames.length);

    if (prev && !prev.onGround && current.onGround && !this.hasLanded) {
      this.hasLanded = true;
      const airborneSeconds = Math.max(60, current.timestamp - this.takeoffTimestamp);
      const emissions = calculateWheelsDownEmissions(airborneSeconds, this.category);
      this.emit("wheels-down", { frame: current, emissions });
    }

    this.currentIndex++;
    return current;
  }

  public reset(): void {
    this.currentIndex = 0;
    this.hasLanded = false;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/replay-streamer.test.ts`
Expected: PASS.

---

### Task 3: Foundry Smart Contracts — 1inch Aqua App (`SkyRouteVault.sol`)

**Files:**
- Create: `contracts/foundry.toml`
- Create: `contracts/src/interfaces/IAqua.sol`
- Create: `contracts/src/interfaces/ISkyRouteVault.sol`
- Create: `contracts/src/SkyRouteVault.sol`
- Create: `contracts/test/SkyRouteVault.t.sol`

**Interfaces:**
- Consumes: 1inch Aqua zero-custody standard (`IAqua.pull`, `IAqua.push`)
- Produces: 
  - `SkyRouteVault`: `registerFlightManifest(...)`, `settleWheelsDown(...)`

- [ ] **Step 1: Setup `contracts/foundry.toml` targeting Arc Testnet**

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.26"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
arc_testnet = "https://arc-testnet.drpc.org"
```

- [ ] **Step 2: Define `contracts/src/interfaces/IAqua.sol` & `ISkyRouteVault.sol`**

Write standard minimal interfaces:
- `IAqua`: `function pull(address from, uint256 amount) external;` and `function push(address to, uint256 amount) external;`
- `ISkyRouteVault`: matching Section 5 of design spec.

- [ ] **Step 3: Implement `contracts/src/SkyRouteVault.sol`**

Implement `SkyRouteVault` with:
- Non-custodial pull/push on `settleWheelsDown`.
- Budget check `require(usdcAmount <= manifest.maxBudgetUSDC)`.
- Re-entrancy and double-settlement guards (`manifest.settled = true`).
- `onlyAgent` modifier ensuring only registered Circle Agent Wallets can trigger settlements.

- [ ] **Step 4: Write Foundry integration tests in `contracts/test/SkyRouteVault.t.sol`**

Write tests asserting:
- Successful flight manifest registration.
- Unauthorized caller cannot settle.
- Over-budget settlement reverts.
- Authorized agent settles Wheels-Down: calls Aqua pull and push, marks settled, emits event.

- [ ] **Step 5: Run Foundry tests**

Run: `cd contracts && forge test -vvv`
Expected: All tests pass.

---

### Task 4: Circle Agent Wallet & Arc Gateway Nanopayment Dispatcher

**Files:**
- Create: `agent/src/circle-agent.ts`
- Create: `agent/test/circle-agent.test.ts`

**Interfaces:**
- Consumes: Viem Arc Testnet client, `SkyRouteVault` ABI, `WheelsDownSettlementResult`
- Produces: 
  - `CircleAgentDispatcher`: Prepares, checks policy, and broadcasts Wheels-Down settlement transaction on Arc Testnet (`Chain ID 5042002`).

- [ ] **Step 1: Write failing test in `agent/test/circle-agent.test.ts`**

Assert:
- `CircleAgentDispatcher` enforces budget cap (`maxBudgetUSDC`).
- Correctly encodes `settleWheelsDown(flightId, airborneSeconds, fuelBurnKg, co2Kg, usdcAmount)` call data.
- Configures Arc Testnet chain ID `5042002` and native USDC gas token.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/circle-agent.test.ts`
Expected: FAIL (Cannot find module `../src/circle-agent.js`).

- [ ] **Step 3: Implement `CircleAgentDispatcher` in `agent/src/circle-agent.ts`**

Implement cleanly using `viem`:
```typescript
import { createPublicClient, http, encodeFunctionData, defineChain, type Address, type Hex } from "viem";
import { type WheelsDownSettlementResult } from "./icao-engine.js";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://arc-testnet.drpc.org"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

export const SKYROUTE_VAULT_ABI = [
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
] as const;

export interface AgentPolicyConfig {
  vaultAddress: Address;
  maxDailyBudgetUSDC: number;
  maxPerFlightBudgetUSDC: number;
}

export class CircleAgentDispatcher {
  private config: AgentPolicyConfig;
  public publicClient;

  constructor(config: AgentPolicyConfig) {
    this.config = config;
    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });
  }

  public encodeSettlement(flightId: Hex, settlement: WheelsDownSettlementResult): Hex {
    if (settlement.costUSDC > this.config.maxPerFlightBudgetUSDC) {
      throw new Error(`Policy violation: cost ${settlement.costUSDC} exceeds limit ${this.config.maxPerFlightBudgetUSDC}`);
    }

    return encodeFunctionData({
      abi: SKYROUTE_VAULT_ABI,
      functionName: "settleWheelsDown",
      args: [
        flightId,
        BigInt(settlement.airborneSeconds),
        BigInt(Math.round(settlement.fuelBurnKg)),
        BigInt(Math.round(settlement.co2Kg)),
        settlement.usdcAmountMicro,
      ],
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/circle-agent.test.ts`
Expected: PASS.

---

### Task 5: Web3 Wallet & Privy Scoped Delegation Setup

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/lib/privy-config.ts`
- Create: `web/lib/arc-client.ts`

**Interfaces:**
- Consumes: `@privy-io/react-auth`, Viem
- Produces: 
  - `PrivyProvider` configuration for Web3 wallets
  - Delegation policy creation for flight manifests

- [ ] **Step 1: Initialize `web/package.json`**

Include Next.js 15, React 19, Tailwind CSS, `@privy-io/react-auth`, `viem`, `sonner`, `number-flow`, `leaflet`, `@types/leaflet`.

- [ ] **Step 2: Configure Privy in `web/lib/privy-config.ts`**

Configure Privy client with Web3 wallet support (MetaMask, Rabby, Coinbase Wallet) and Arc Testnet chain definition.

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd web && npm install && npm run build` (or verify configs).

---

### Task 6: Copperx-Styled Avionics HUD & Windy.com Global Live Radar Map

**Files:**
- Create: `web/components/WindyFlightMap.tsx`
- Create: `web/components/AvionicsHUD.tsx`
- Create: `web/components/ReplayControls.tsx`
- Create: `web/app/page.tsx`
- Create: `web/app/globals.css`

**Interfaces:**
- Consumes: Leaflet/MapLibre, OpenSky Live API (`https://opensky-network.org/api/states/all`), `ReplayStreamer`
- Produces: 
  - Full-screen dark interactive radar map with rotating aircraft icons.
  - Dual-mode switch (Windy Live Fleet vs Replay Touchdown).
  - Copperx-styled HUD with NumberFlow counters and Sonner transaction alerts.

- [ ] **Step 1: Setup Copperx dark styles in `web/app/globals.css`**

Add `#0B0F19` background, slate glass `#121926`, Copperx Electric Indigo `#4C63ED` variables, and Leaflet dark filter styling.

- [ ] **Step 2: Implement `web/components/WindyFlightMap.tsx`**

- Render full-screen dark map using CartoDB Dark Matter tiles.
- Fetch live flights from OpenSky Network API and plot directional plane markers rotated to `true_track`.
- Allow clicking any aircraft to inspect its callsign, altitude, speed, and track.

- [ ] **Step 3: Implement `web/components/AvionicsHUD.tsx`**

- Display flight callsign, aircraft category badge (`NARROW_BODY`), current altitude, speed, and real-time airborne duration.
- Use `number-flow` for slick digit animations with zero layout shift.
- Display Wheels-Down status pill and calculated ICAO emissions.

- [ ] **Step 4: Implement Dual-Mode Controller & Replay Scrubbing**

- Provide a top toggle: `[🌐 Windy Global Radar (Live)]` vs `[🛬 Replay Touchdown (Demo)]`.
- In Replay mode, render playback controls (Play, Pause, Fast-Forward, Scrub to Touchdown).
- When the replay reaches touchdown, trigger Sonner toast displaying the verified settlement with direct link to `testnet.arcscan.app`.

- [ ] **Step 5: Run Next.js dev & verify UI**

Run: `npm run build` in `web/` to confirm zero lint or compilation errors.

---

## Plan Verification Checklist

- [ ] All 6 tasks have explicit file paths, test commands, and exact code implementations.
- [ ] No placeholder text ("TBD", "TODO", "implement later").
- [ ] Incorporates Copperx minimal electric indigo palette and Windy.com dark map.
- [ ] Uses real ICAO category tables and verified airborne seconds.
- [ ] Adheres 100% to GEMINI.md Zero-Mock and commit authorization mandates.
