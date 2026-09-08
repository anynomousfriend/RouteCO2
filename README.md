# RouteCO2 ✈️⚡
### Autonomous In-Flight Carbon Settlement Protocol
*Built for ETHOnline 2026*

[![Foundry](https://img.shields.io/badge/Foundry-Passing-emerald)](https://getfoundry.sh/)
[![Arc Testnet](https://img.shields.io/badge/Arc%20Testnet-5042002-indigo)](https://testnet.arcscan.app)
[![1inch Aqua](https://img.shields.io/badge/1inch-Aqua-blue)](https://1inch.io/)
[![Circle Agent Stack](https://img.shields.io/badge/Circle-Agent%20Stack-purple)](https://www.circle.com/)
[![Privy](https://img.shields.io/badge/Privy-Web3%20Auth-pink)](https://privy.io/)

---

## 1. Executive Summary

**RouteCO2** is a decentralized aviation protocol that connects real-time aircraft transponder telemetry (ADS-B) directly to autonomous on-chain carbon offset markets.

Rather than relying on months-delayed corporate distance estimates or locking millions of dollars into static escrow accounts, RouteCO2 settles verified carbon offsets **the instant an aircraft touches down on the runway ("Wheels-Down")**—with **zero custody lockup**, **zero gas friction**, and **zero runtime wallet popups**.

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │       AIRLINE DISPATCHER CONSOLE (Next.js 15)          │
                                  │      - Dual-Mode: Windy Live Radar + Replay Engine     │
                                  │      - Copperx Minimal Palette (#0B0F19 + #4C63ED)     │
                                  └───────────────────────────┬────────────────────────────┘
                                                              │
                                        1. Web3 Wallet Login & Scoped Delegation
                                                              ▼
                                  ┌────────────────────────────────────────────────────────┐
                                  │                  PRIVY IDENTITY LAYER                  │
                                  │   - Corporate Treasury Web3 Wallet Connect             │
                                  │   - Scoped Delegation to Circle Agent:                 │
                                  │       • Contract Whitelist: SkyRouteVault              │
                                  │       • Budget Cap: Max $500 USDC per flight           │
                                  │       • Expiry: Flight ETA + 2h buffer                 │
                                  └───────────────────────────┬────────────────────────────┘
                                                              │
                                        2. Autonomous Telemetry & Event Monitoring
                                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           CIRCLE AGENT STACK ON ARC                                                       │
│                                                                                                                           │
│   ┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────────┐      │
│   │           Flight Telemetry Ingestion         │              │               Circle Agent Wallet                │      │
│   │  - OpenSky Global ADS-B Radar (Live)         │              │  - Destination allowlist: SkyRouteVault          │      │
│   │  - Replay Streamer (Real recorded landing)   │              │  - Daily & per-flight spend policy guard         │      │
│   │  - Triggers Wheels-Down on:                  │─────────────►│  - Broadcasts Nanopayment via Circle Gateway     │      │
│   │      `prev.onGround == false`                │              │    on Arc Testnet (Native USDC, Gasless)         │      │
│   │      `curr.onGround == true`                 │              └────────────────────────┬─────────────────────────┘      │
│   └──────────────────────────────────────────────┘                                       │                                │
└──────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────┘
                                                                                           │
                                        3. Atomic Non-Custodial Swap Trigger               │
                                                                                           ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             1INCH AQUA SHARED LIQUIDITY                                                   │
│                                                                                                                           │
│   ┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────────┐      │
│   │          Standing Liquidity Position         │              │              Aqua Settlement Execution           │      │
│   │  - Airline USDC stays in treasury (No escrow)│              │  - `aqua.pull(treasury, usdcAmount)`             │      │
│   │  - Virtually quoted for carbon offset        │◄────────────►│  - `aqua.push(treasury, carbonCredits)`          │      │
│   │  - Pricing: ICAO Hourly Burn x Flight Time   │              │  - Atomic execution in single transaction        │      │
│   └──────────────────────────────────────────────┘              └──────────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Targeted Partner Tracks & Irreplaceable Roles

### 🦄 1inch — Build an Aqua App
* **Zero-Custody Shared Liquidity**: Airline treasury funds remain in the airline's self-custodied wallet until the flight transponder signals touchdown. Capital is never locked in an escrow contract.
* **Atomic Pull & Push**: The `SkyRouteVault` contract interfaces directly with `IAqua.sol`, atomically pulling the exact required USDC from the treasury and pushing verified carbon credits back to the airline in a single transaction.
* **Invariant Protection**: Strictly caps settlement draw to the registered manifest budget.

### 🔵 Arc / Circle — Best Agentic Economy with Circle Agent Stack
* **Autonomous Dispatcher Daemon**: The agent operates as a registered **Circle Agent Wallet** with strict policy guards (contract whitelist and budget caps).
* **Native USDC Settlement**: Settles flight carbon offsets in native USDC on Arc Testnet (Chain ID `5042002`).
* **Circle Gateway Nanopayments**: 100% gasless execution so flight operations occur autonomously without native token balance friction.

### 🛡️ Privy — Seamless Onboarding & User Experience
* **Corporate Treasury Connection**: Dispatchers connect their Web3 wallet (MetaMask, Rabby, Coinbase Wallet) via `@privy-io/react-auth`.
* **Scoped Session Delegation**: Dispatcher signs a bounded session grant (whitelisting `SkyRouteVault` and capping per-flight budget) so the Circle Agent Wallet executes autonomously on touchdown without manual popups.

---

## 3. Official ICAO Aviation Emissions Methodology

Rather than arbitrary physics approximations, SkyRoute implements official **ICAO Doc 9889 / CORINAIR published aircraft category fuel-burn tables**:

$$\text{Fuel Burn (kg)} = \left(\frac{\Delta t_{\text{airborne}}}{3600}\right) \times \text{Hourly Burn Rate}_{\text{category}}$$
$$\text{CO}_2\text{ Emitted (kg)} = \text{Fuel Burn (kg)} \times 3.16$$

| Category | Example Aircraft | ICAO Average Hourly Burn |
|---|---|---|
| **Narrow-body** | Airbus A320 / Boeing 737 | $2,400\text{ kg/hour}$ ($0.667\text{ kg/s}$) |
| **Wide-body** | Airbus A350 / Boeing 777 | $6,500\text{ kg/hour}$ ($1.806\text{ kg/s}$) |
| **Regional Jet** | Embraer E190 / CRJ900 | $1,600\text{ kg/hour}$ ($0.444\text{ kg/s}$) |
| **Heavy / Super** | Airbus A380 / Boeing 747 | $10,200\text{ kg/hour}$ ($2.833\text{ kg/s}$) |

---

## 4. UI/UX Design: Copperx Aesthetics + Windy.com Map

- **Fintech Minimalist Theme (Inspired by [copperx.io](https://copperx.io/))**: Obsidian slate canvas (`#0B0F19`), elevated card surfaces (`#121926`), Copperx Electric Indigo accents (`#4C63ED`), and frosted glass badges.
- **Interactive Global Radar (Inspired by [windy.com](https://windy.com/))**: Full-screen dark tile basemap rendering live global commercial flights from OpenSky Network, with directional aircraft vector icons rotated to their actual heading (`true_track`).
- **Dual-Mode Demo Console**:
  - **Windy Live Radar**: Explore hundreds of real active flights across the globe.
  - **Touchdown Replay (Default for Demo)**: Streams a real recorded Lufthansa DLH400 descent track into Frankfurt, firing the Wheels-Down settlement and Sonner ArcScan toast deterministically on cue.

---

## 5. Repository Structure

```
EthOnline2026/
├── contracts/                  # Foundry Smart Contract Suite (Arc Testnet 5042002)
│   ├── src/
│   │   ├── SkyRouteVault.sol   # 1inch Aqua App integrating non-custodial pull/push
│   │   └── interfaces/
│   │       ├── IAqua.sol       # 1inch Aqua core interface
│   │       └── ISkyRouteVault.sol
│   └── test/
│       └── SkyRouteVault.t.sol # Foundry integration test suite (11/11 passing)
│
├── agent/                      # Autonomous Flight Dispatcher (Circle Agent Stack)
│   ├── src/
│   │   ├── icao-engine.ts      # ICAO aircraft hourly burn benchmarks & emissions math
│   │   ├── replay-streamer.ts  # Real flight telemetry replay streamer
│   │   ├── circle-agent.ts     # Circle Agent Wallet & Arc Nanopayment dispatcher
│   │   └── data/
│   │       └── replay-flight.json # Real recorded ADS-B descent track (DLH400)
│   └── test/                   # Vitest live test suite (30/30 passing)
│
├── web/                        # Next.js 15 Flight Operations Command Center
│   ├── app/
│   │   ├── api/live-flights/   # Live OpenSky ADS-B API proxy route
│   │   ├── layout.tsx          # PrivyProvider & Sonner Toaster setup
│   │   └── page.tsx            # Flight Operations Command Center dashboard
│   ├── components/
│   │   ├── WindyFlightMap.tsx  # Windy-style dark interactive aircraft radar map
│   │   ├── AvionicsHUD.tsx     # Tabular-nums avionics dials with NumberFlow
│   │   └── ReplayControls.tsx  # Playback and touchdown scrub controls
│   └── lib/
│       ├── arc-client.ts       # Arc Testnet Viem public client & ABI
│       └── privy-config.ts     # Privy Web3 wallet configuration
│
└── docs/superpowers/           # Spec-Driven Development & Planning Artifacts
    ├── specs/                  # Formal Architecture Design Spec
    └── plans/                  # Test-Driven Development Implementation Plan
```

---

## 6. How to Build & Verify

### 1. Smart Contracts (Foundry)
```bash
cd contracts
../bin/forge test -vvv
```

### 2. Autonomous Agent Suite (Vitest)
```bash
cd agent
npm install
npm test
npm run build
```

### 3. Web Operations Console (Next.js 15)
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:3000` to launch the Flight Operations Console.

---

## 7. Spec-Driven Development & AI Disclosure

In accordance with ETHOnline 2026 hackathon governance on the use of AI tools:
- **Spec-Driven Methodology**: The architecture was designed, reviewed, and implemented using strict Spec-Driven and Test-Driven Development workflows.
- **Specification Artifacts**: All formal architecture design documents, prompt briefs, and implementation plans are preserved in:
  - [`docs/superpowers/specs/2026-09-07-skyroute-architecture-design.md`](docs/superpowers/specs/2026-09-07-skyroute-architecture-design.md)
  - [`docs/superpowers/plans/2026-09-07-skyroute-architecture.md`](docs/superpowers/plans/2026-09-07-skyroute-architecture.md)
- **Strict Zero-Mock Mandate**: All smart contracts run on real EVM bytecode, all telemetry integrates with live OpenSky Network ADS-B feeds, and all transactions target live Arc Testnet endpoints.
