<p align="center">
  <img src="web/public/cover.png" width="100%" alt="RouteCO2 Cover Banner" />
</p>

<p align="center">
  <img src="web/public/logo.svg" width="88" height="88" alt="RouteCO2 Logo" />
</p>

<h1 align="center">RouteCO2</h1>
<h3 align="center">Autonomous In-Flight Carbon Settlement Protocol & 3D Aviation Command Center</h3>
<p align="center"><em>Built for ETHOnline 2026</em></p>

<p align="center">
  <a href="https://getfoundry.sh/"><img src="https://img.shields.io/badge/Foundry-Passing%20(29%2F29)-emerald" alt="Foundry" /></a>
  <a href="https://testnet.arcscan.app"><img src="https://img.shields.io/badge/Arc%20Testnet-5042002-indigo" alt="Arc Testnet" /></a>
  <a href="https://1inch.io/"><img src="https://img.shields.io/badge/1inch-Aqua%20%26%20SwapVM-blue" alt="1inch Aqua & SwapVM" /></a>
  <a href="https://www.circle.com/"><img src="https://img.shields.io/badge/Circle-Agent%20Stack-purple" alt="Circle Agent Stack" /></a>
  <a href="https://privy.io/"><img src="https://img.shields.io/badge/Privy-Session%20Keys-pink" alt="Privy" /></a>
  <a href="https://cesium.com/"><img src="https://img.shields.io/badge/CesiumJS-3D%20Digital%20Earth-teal" alt="CesiumJS" /></a>
</p>

---

## 1. What is RouteCO2 & Why is it Needed?

The global aviation industry contributes **over 1 billion tonnes of CO₂ annually** (~2.5% of global emissions). Under international CORSIA regulations and corporate ESG mandates, airlines and corporate jet operators are obligated to purchase carbon credits to offset flight emissions.

### The Problem with Existing Aviation Carbon Offset Settlement
1. **Opaque & Delayed Reconciliation**: Airlines currently settle offsets months after flights occur, relying on blunt Great-Circle airport-to-airport distance averages rather than actual flight paths, holding patterns, wind delays, or vertical climb power profiles.
2. **Dead Capital & Custodial Escrow**: Traditional models require airlines to lock millions of dollars into static escrow accounts or pay substantial broker markups to third-party intermediaries.
3. **Manual Human Invoices & Greenwashing**: Offsets are purchased via bulk paperwork quarterly or annually. There is zero cryptographic proof linking a specific commercial flight's transponder data to a specific on-chain retirement receipt.

### The RouteCO2 Solution
**RouteCO2 connects real-time aircraft transponder telemetry (ADS-B) directly to autonomous on-chain carbon exchange.**

* **Real Kinematic Telemetry**: Ingests live ADS-B radar fixes (altitude, speed, vertical climb/descent rate) from OpenSky Network and global receiver stations.
* **ICAO Precision Aerodynamics**: Evaluates high-precision ICAO Doc 9889 / BADA fuel-burn algorithms across 18 commercial airframe benchmarks (A320, B738, B77W, A359, A388, E190, etc.).
* **Dynamic SwapVM Bytecode Curves**: Dynamic pricing curves compiled into 1inch SwapVM bytecode opcodes (`0x01020304`), discounting fuel burn at aerodynamic cruise altitudes ($>9,000\text{ m}$) while scaling climb thrust penalties ($>2\text{ m/s}$).
* **Wheels-Down Autonomous Settlement**: The exact instant an aircraft touches down on the runway (`on_ground: true`), the autonomous agent settles the offset natively in USDC on Arc Testnet via `SkyRouteVault.sol`—with **zero custody lockup**, **zero gas token friction**, and **zero runtime wallet popups**.

---

## 2. End-to-End System Architecture

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │       FLIGHT OPERATIONS CONSOLE (Next.js 15)           │
                                  │      - 3D Digital Globe (CesiumJS WebGL Engine)        │
                                  │      - 2D Tactical Radar + Touchdown Replay Mode       │
                                  │      - Landed Flights Queue & 1-Click Settlement Tab   │
                                  └───────────────────────────┬────────────────────────────┘
                                                              │
                                        1. Web3 Login & Bounded Flight Delegation
                                                              ▼
                                  ┌────────────────────────────────────────────────────────┐
                                  │                  PRIVY IDENTITY LAYER                  │
                                  │   - Corporate Flight Operations Passkey Onboarding     │
                                  │   - Non-Custodial Embedded Smart Wallet                │
                                  │   - Scoped Flight Manifest Session Delegation:         │
                                  │       • Target Whitelist: SkyRouteVault                │
                                  │       • Per-Flight Budget Cap: Max $500 USDC           │
                                  │       • Time Expiry (8h) + 1-Click Emergency Abort     │
                                  └───────────────────────────┬────────────────────────────┘
                                                              │
                                        2. Autonomous Dispatch Pipeline (Zero Popups)
                                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           CIRCLE AGENT STACK ON ARC                                                       │
│                                                                                                                           │
│   ┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────────┐      │
│   │           Flight Telemetry Ingestion         │              │               Circle Agent Wallet                │      │
│   │  - OpenSky Global ADS-B Radar (Live)         │              │  - Target allowlist: SkyRouteVault               │      │
│   │  - Multi-tier proxy with credit governor     │              │  - Daily & per-flight spend policy guard         │      │
│   │  - Automated "When Landed -> Settle" Trigger │─────────────►│  - Broadcasts native USDC settlement via         │      │
│   │  - Triggers Wheels-Down on:                  │              │    Circle Developer Wallets, Arc Testnet (5042002) │      │
│   │      `prev.onGround == false`                │              └────────────────────────┬─────────────────────────┘      │
│   │      `curr.onGround == true`                 │                                       │                                │
│   └──────────────────────────────────────────────┘                                       │                                │
└──────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────┘
                                                                                           │
                                        3. Compiles dynamic fuel curve to SwapVM Bytecode  │
                                                                                           ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             1INCH AQUA & SWAPVM LAYER                                                     │
│                                                                                                                           │
│   ┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────────┐      │
│   │           1inch Aqua Core Registry           │              │             SwapVM Execution Router              │      │
│   │  - Zero-Custody: Airline USDC stays in wallet│              │  - Runs compiled fuel-efficiency bytecode        │      │
│   │  - Virtual TVU: Backs flight manifest offsets│◄────────────►│  - Enforces cruise-discount & climb-rate math    │      │
│   │  - Calls `aqua.pull()` (real USDC) & retires    │              │  - Atomic settlement without fund lockup         │      │
│   └──────────────────────────────────────────────┘              └──────────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Targeted Partner Tracks & Irreplaceable Tech Alignment

### 🦄 Track 1: 1inch — Build an Aqua App
* **Zero-Custody Shared TVU (`AquaCore.sol` & `IAqua.sol`)**:
  Airline treasury funds remain in the airline's self-custodied wallet until transponders confirm touchdown. Capital is never locked in escrow contracts or custody pools. The interface matches the real 1inch Aqua protocol (`ship` / `dock` / `pull` / `push` / `rawBalances` / `safeBalances`): the treasury ships its own immutable strategy via `aqua.ship()` (Aqua maker is always the shipper), and settlement pulls real USDC via `aqua.pull()` (`transferFrom` treasury → vault, requiring treasury approval to Aqua).
* **SwapVM Flight Fuel Curve Engine (`SwapVMRuleEngine.sol`)**:
  Flight profiles are compiled into SwapVM bytecode opcodes executed on-chain (Arc-local compact projection of the canonical `1inch/swap-vm` program model — the canonical router `0x111111338c5091E8440b67B168bAe16a668AC0De` is not deployed on Arc, so Arc evaluates the equivalent curve locally):
  * `0x01` (`OP_DYNAMIC_BALANCES`): Base fuel burn balance allocation from airframe benchmark (≡ `_dynamicBalancesXD`).
  * `0x02` (`OP_PIECEWISE_LINEAR_SCALE`): Cruise altitude discount down to $0.80\times$ factor when altitude $>9,000\text{ m}$; climb thrust penalty up to $1.35\text{--}1.50\times$ factor when climb rate $>2\text{ m/s}$.
  * `0x03` (`OP_FLAT_FEE_AMOUNT_IN`): Certified carbon offset valuation at $\$25.00\text{ USDC} / \text{tonne CO}_2$ (≡ `_flatFeeAmountInXD`).
  * `0x04` (`OP_DECAY`): Waypoint / descent decay opcode (≡ `_decayXD`).
* **Atomic Pull & Retire**:
  On touchdown, `SkyRouteVault` pulls real USDC via `aqua.pull(treasury, strategyHash, usdc, usdcAmount, vault)` in the settlement transaction and retires carbon in the on-ledger accumulator. Carbon retirement is on-chain accounting (`totalCarbonOffsetKg`) plus receipt events, not an ERC20 transfer.

### 🔵 Track 2: Arc / Circle — Best Agentic Economy with Circle Agent Stack
* **Autonomous Flight Dispatcher Daemon**:
  Operates as an autonomous Circle Agent Wallet (`agent/src/circle-wallet.ts`) with cryptographic policy guards: target contract whitelisting (`SkyRouteVault`), daily spend caps, and per-flight budget thresholds. SCA wallets are Gas Station gasless-capable.
* **Sub-Second Finality & Native USDC Gas**:
  Settles flight manifest registrations and wheels-down offsets natively in USDC on Arc Testnet (Chain ID `5042002`), eliminating multi-token conversion friction. Arc Testnet USDC: `0x3600000000000000000000000000000000000000`.
* **Circle Developer-Controlled Wallets + Gas Station (`agent/src/circle-developer-client.ts`)**:
  Real `@circle-fin/developer-controlled-wallets` integration: wallet sets, `ARC-TESTNET` SCA wallets, SDK transfers with terminal-state polling. Testnet Gas Station policy sponsors qualifying SCA transactions; Circle Paymaster addresses documented for user-pays-USDC ERC-4337 flows.
* **Automated Touchdown Settlement Broadcaster (`agent/src/arc-settler.ts`)**:
  Autonomously monitors transponder states and submits verifiable transactions to Arc Testnet.

### 🛡️ Track 3: Privy — Seamless Onboarding & Scoped Session Keys
* **Corporate Flight Dispatcher Onboarding**:
  Dispatchers log in via `@privy-io/react-auth` in $<3$ seconds using Passkeys/FaceID with embedded smart wallets.
* **Scoped Flight Manifest Session Keys (`web/components/SessionDelegationModal.tsx`, `web/lib/privy-signers.ts`)**:
  Dispatcher grants a bounded session delegation key via real Privy `addSigners` (key quorum + dashboard policy):
  * *Contract Whitelist*: Strictly restricted to `SkyRouteVault` (`0x469CA8E59ae25CBEEC2eA52617163E2396B9bdA1`), AquaCore, and Arc USDC.
  * *Flight Budget Cap*: Configurable max budget (default \$500 USDC).
  * *Time-Bounded Expiry*: Auto-expires after 8 hours.
  * *1-Click Emergency Abort*: Immediately revokes all agent delegation.
* **Frictionless Autonomous Settlement**:
  Zero wallet popups during flight touchdown; the agent signs within verified session delegation limits.

---

## 4. Key Features & Capabilities

### 🌐 3D CesiumJS Digital Earth Engine
High-precision aerospace telemetry and interpolation architecture:
1. **30-Second Render-Behind Playback** ([`web/lib/motion-engine.ts`](web/lib/motion-engine.ts)):
   Renders transponder fixes at `now - 30s` with Hermite/linear interpolation between verified fixes, completely eliminating rubber-banding and snap-back.
2. **Constant-Rate-Turn (CRT) ENU Arc Extrapolation**:
   When transponder fixes are delayed, motion is integrated as circular arcs in the local East-North-Up tangent plane based on turn rate ($\omega$).
3. **EGM96 Geoid Datum Elevation Correction ($h = H + N$)**:
   Corrects barometric altitude ($H$) by adding local EGM96 geoid undulation ($N$) via `egm96-universal`, preventing landing aircraft from clipping into airport terrain.
4. **GPU-Batched Screen-Basis Projection**:
   Renders thousands of aircraft in **1 draw call** via `Cesium.BillboardCollection`, projecting course rotation onto camera `rightWC` and `upWC` basis vectors without 3D pitch distortion.
5. **3D Geodesic Breadcrumbs**:
   Curved glowing flight trails using `Cesium.ArcType.GEODESIC` and `depthFailMaterial`.
6. **Multi-Tier Proxy with Credit Governor** ([`web/lib/flight-proxy.ts`](web/lib/flight-proxy.ts)):
   OAuth2 token coalescing, credit governor with adaptive TTL (9s–30s), 429 backoff, fail-soft stale cache, and regional bounding fallback to `adsb.lol`.

### ⚡ Automated "When Landed -> Settle" Trigger
* Select any active airborne flight in the 3D globe or radar map and click **"Arm Auto-Settle on Landing"**.
* The dispatcher monitors altitude and transponder `on_ground` state.
* On touchdown, the agent autonomously executes the settlement transaction on Arc Testnet and emits an ArcScan receipt.

### 📋 Landed Flights Queue & 1-Click Settlement Tab
* Dedicated navigation tab in the dock (**Clock icon** with live pending badge).
* Lists aircraft with confirmed wheels-down arrival awaiting carbon offset settlement.
* Shows arrival airport, airborne duration, distance, total fuel consumed (kg), verified $\text{CO}_2$ emitted (kg), and the SwapVM USDC quote.
* Features **"Settle Carbon Offset"** and **"Batch Settle All"** buttons for immediate live on-chain demonstration during hackathon evaluation.

---

## 5. Official ICAO Aviation Emissions Methodology

SkyRoute implements official **ICAO Doc 9889 / CORINAIR published aircraft fuel-burn formulas**:

$$\text{Fuel Burn (kg)} = \left(\frac{\Delta t_{\text{airborne}}}{3600}\right) \times \text{Hourly Burn Rate}_{\text{airframe}} \times \text{SwapVM Multiplier}$$
$$\text{CO}_2\text{ Emitted (kg)} = \text{Fuel Burn (kg)} \times 3.16$$
$$\text{Offset Obligation (USDC)} = \left(\frac{\text{CO}_2\text{ (kg)}}{1000}\right) \times \$25.00\text{ USDC}$$

| Category | Representative Airframes | Baseline Fuel Burn | Climb Multiplier | Cruise Multiplier |
|---|---|---|---|---|
| **Narrow-body** | Airbus A320, A321, Boeing 737-800 | $2,400\text{--}2,700\text{ kg/h}$ | $1.40\times$ | $0.80\times$ |
| **Wide-body** | Airbus A350-900, Boeing 777-300ER, 787 | $5,300\text{--}6,800\text{ kg/h}$ | $1.35\text{--}1.45\times$ | $0.80\times$ |
| **Heavy / Super** | Airbus A380-800, Boeing 747-400 | $10,200\text{--}11,400\text{ kg/h}$ | $1.48\text{--}1.50\times$ | $0.80\times$ |
| **Regional Jet** | Embraer E190, CRJ-900 | $1,550\text{--}1,650\text{ kg/h}$ | $1.30\times$ | $0.80\times$ |

---

## 6. Live Arc Testnet Deployments & Verifications

All smart contracts are deployed to **Arc Testnet (Chain ID `5042002`)** and verifiable on [ArcScan](https://testnet.arcscan.app):

| Contract / Method | Deployed Address / Tx Hash | ArcScan Explorer Verification |
|---|---|---|
| **SkyRouteVault** (Core App) | `0x469CA8E59ae25CBEEC2eA52617163E2396B9bdA1` | [View on ArcScan](https://testnet.arcscan.app/address/0x469CA8E59ae25CBEEC2eA52617163E2396B9bdA1) |
| **SwapVMRuleEngine** (Flight Curve) | `0x6a4b3C76a5e2Cf1C2d69F05537C5c9Cb8f843D30` | [View on ArcScan](https://testnet.arcscan.app/address/0x6a4b3C76a5e2Cf1C2d69F05537C5c9Cb8f843D30) |
| **AquaCore** (Shared TVU) | `0xE3Ec9dEb24fF3AD05cF0324b77DA128078780535` | [View on ArcScan](https://testnet.arcscan.app/address/0xE3Ec9dEb24fF3AD05cF0324b77DA128078780535) |
| **Arc Testnet USDC** (ERC-20) | `0x3600000000000000000000000000000000000000` | [View on ArcScan](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) |
| **setAuthorizedAgent** | `0x3bf34932aaa2747ab2329cd64f0175e64328e19949e795b6311188483f1e17e8` | [View Tx](https://testnet.arcscan.app/tx/0x3bf34932aaa2747ab2329cd64f0175e64328e19949e795b6311188483f1e17e8) |
| **registerFlightManifest** (LH414) | `0xc485728df0bf5ba0560a1ec66be8a1f5aa3ba044c55d9360bb22b5cf2f43b9c6` | [View Tx](https://testnet.arcscan.app/tx/0xc485728df0bf5ba0560a1ec66be8a1f5aa3ba044c55d9360bb22b5cf2f43b9c6) |
| **settleWheelsDown** (126 kg CO₂, $3.15 real USDC pull) | `0x2ed8e3cb8c41f6cc5b67a3803544a26bdb224318a9b6ea853b201bd4af6655f5` | [View Tx](https://testnet.arcscan.app/tx/0x2ed8e3cb8c41f6cc5b67a3803544a26bdb224318a9b6ea853b201bd4af6655f5) |
| **UI route settle** (RDY100, block 61386097) | `0xac86375297f7d7ab9a42d96fdf589a92e7d086b02fe8e999e5fd0cb97f2bef0a` | [View Tx](https://testnet.arcscan.app/tx/0xac86375297f7d7ab9a42d96fdf589a92e7d086b02fe8e999e5fd0cb97f2bef0a) |
| **Circle fund Circle wallet** (1 USDC) | `0x47f1c306f78a7667fbbdae57fd3f07247d17ef41c92dc885e389f5a76b1423dd` | [View Tx](https://testnet.arcscan.app/tx/0x47f1c306f78a7667fbbdae57fd3f07247d17ef41c92dc885e389f5a76b1423dd) |
| **Circle SDK transfer** (0.1 USDC, COMPLETE) | `0x524969b1da269b5a7d3de072c0ebe1f355431a43d3e451325adf4211f13f1072` | [View Tx](https://testnet.arcscan.app/tx/0x524969b1da269b5a7d3de072c0ebe1f355431a43d3e451325adf4211f13f1072) |

### Direct On-Chain Carbon Credit Accumulator
Every flight reconciliation increments the airline treasury's certified retired carbon credits directly in storage:
```solidity
totalCarbonOffsetKg[manifest.treasury] += co2Kg;
```
The operations console queries `totalCarbonOffsetKg(address)` via live RPC (`arc-testnet.drpc.org`), displaying verifiable cryptographic CO₂ retirement without centralized caching.

---

## 7. Repository Structure

```
RouteCO2/
├── contracts/                  # Foundry Smart Contract Suite (Arc Testnet 5042002)
│   ├── src/
│   │   ├── SkyRouteVault.sol   # 1inch Aqua App callback contract hooking into SwapVM
│   │   ├── SwapVMRuleEngine.sol# SwapVM flight curve interpreter (Opcodes: 0x01, 0x02, 0x03, 0x04)
│   │   ├── AquaCore.sol        # 1inch Aqua shared liquidity registry (real ship/dock/pull/push)
│   │   └── interfaces/
│   │       ├── IAqua.sol       # 1inch Aqua core interface (ship, dock, pull, push, balances)
│   │       ├── ISkyRouteVault.sol
│   │       └── ISwapVMRuleEngine.sol
│   └── test/
│       ├── SkyRouteVault.t.sol # Real USDC pull + Aqua accounting tests (22 passing)
│       └── SwapVMRuleEngine.t.sol # Opcode evaluations & curve bounds (7 passing)
│
├── agent/                      # Autonomous Flight Dispatcher (Circle Agent Stack)
│   ├── src/
│   │   ├── dispatcher.ts       # OpenSky ADS-B poller & flight monitor loop
│   │   ├── icao-engine.ts      # Aviation fuel burn & CO2 emissions calculator
│   │   ├── circle-wallet.ts    # Circle Developer-Controlled Wallet policy guards
│   │   ├── circle-developer-client.ts # Real Circle SDK: wallet sets, ARC-TESTNET transfers
│   │   ├── swapvm-compiler.ts  # Compiles dynamic flight curve to SwapVM bytecode
│   │   ├── arc-settler.ts      # Native USDC settlements on Arc Testnet
│   │   └── verify-live-settlement.ts # Real end-to-end Arc Testnet verification runner
│   └── test/                   # Vitest live test suite (68/68 passing, 8 suites)
│
├── web/                        # Next.js 15 Flight Operations Command Center
│   ├── app/
│   │   ├── api/flights/        # Multi-tier ADS-B proxy with credit governor & adsb.lol fallback
│   │   ├── api/live-flights/   # Live OpenSky ADS-B API route
│   │   ├── api/settle/         # On-chain settlement broadcaster to Arc Testnet
│   │   ├── layout.tsx          # PrivyProvider & Sonner Toaster setup
│   │   └── page.tsx            # Flight Operations Command Center with 3D/2D View Engine
│   ├── components/
│   │   ├── CesiumGlobeViewer.tsx # 3D CesiumJS Digital Earth with live HUD & armed trigger
│   │   ├── LandedSettlementQueue.tsx # Landed Flights Queue with 1-Click Settlement
│   │   ├── WindyFlightMap.tsx  # Tactical Leaflet radar map
│   │   ├── FlightMasterCard.tsx# Live avionics dials, airframe stats, & SwapVM dynamic burn
│   │   ├── DescentTimelineBar.tsx # Touchdown scrubber & auto-settle trigger
│   │   ├── SessionDelegationModal.tsx # Privy Scoped Session Delegation key manager
│   │   ├── SettlementCertificateModal.tsx # Executive cryptographic audit receipt
│   │   ├── AquaInspectorModal.tsx # 1inch Aqua TVU & virtual balance inspector
│   │   ├── FuelDynamicsBento.tsx # Real-time fuel burn vs benchmark bento
│   │   └── SettlementIntegrityBento.tsx # On-chain settlement receipt bento
│   └── lib/
│       ├── flight-tracker-app.ts # 3D client orchestrator with EGM96 geoid correction
│       ├── motion-engine.ts    # 30s render-behind lerp & CRT ENU arc extrapolation
│       ├── flight-layer.ts     # GPU-batched BillboardCollection & screen-basis rotation
│       ├── flight-trail.ts     # 3D geodesic polyline trails with depth-failure material
│       ├── adsbdb-queue.ts     # Leaky bucket priority enrichment queue (5 req/s)
│       ├── icao-precision.ts   # 18 commercial airframe benchmarks & SwapVM pricing
│       ├── flight-proxy.ts     # OpenSky OAuth2 token coalescing & adsb.lol fallback
│       └── arc-client.ts       # Arc Testnet Viem public client & deployed ABI
│
└── docs/superpowers/           # Spec-Driven Development & Audit Artifacts
    ├── specs/                  # Formal Architecture Design Spec
    └── plans/                  # Test-Driven Implementation & Remediation Plans
```

---

## 8. How to Build & Verify

### 1. Smart Contracts (Foundry)
```bash
cd contracts
../bin/forge test -vvv
../bin/forge test --fork-url https://arc-testnet.drpc.org -vvv
```
*All 29/29 tests pass against live Arc Testnet fork.*

### 2. Autonomous Agent Suite (Vitest)
```bash
cd agent
npm install
npm test
npm run build
```
*All 68/68 tests pass across 8 test suites.*

### 3. Web Operations Console (Next.js 15)
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:3000` for the landing page and `http://localhost:3000/app` for the Flight Operations Console.

---

## 9. Spec-Driven Development & AI Disclosure

In accordance with ETHOnline 2026 hackathon governance on the use of AI tools:
* **Spec-Driven Methodology**: The architecture was designed, reviewed, and implemented using strict Spec-Driven Development (SDD) and Test-Driven Development (TDD) workflows.
* **Specification Artifacts**: All formal architecture specifications, prompts, and audit remediation plans are preserved in `docs/superpowers/`.
* **Strict Zero-Mock Mandate**: All smart contracts run real EVM bytecode on Arc Testnet (`5042002`), all telemetry integrates live OpenSky Network ADS-B feeds, and all transactions return verifiable transaction hashes with live block explorer links on [ArcScan](https://testnet.arcscan.app).
