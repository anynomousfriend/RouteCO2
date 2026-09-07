# SkyRoute: Autonomous In-Flight Carbon Settlement Protocol
**Design Specification**
*Date: 2026-09-07*  
*Hackathon: ETHOnline 2026*

---

## 1. Executive Summary & Value Proposition

**SkyRoute** is a decentralized protocol bridging real-time commercial aviation telemetry (ADS-B) directly to autonomous on-chain carbon offset markets.

### The Problem
The \$2B+ corporate aviation carbon-offset market is plagued by:
1. **Opaque Reconciliation Lag**: Airlines calculate and retire carbon offsets months after flights conclude using broad, generalized distance averages.
2. **Capital Inefficiency (Escrow Lockup)**: Traditional platforms require corporate treasuries to lock millions in escrow accounts.
3. **Operational Friction**: Managing gas tokens and transaction popups is unviable for autonomous airline operations.

### The Solution
SkyRoute settles verified carbon offsets **the moment a flight touches down ("Wheels-Down")**:
- **Real Aviation Standards**: Calculates exact $CO_2$ emissions using official ICAO published hourly fuel-burn tables for the aircraft category multiplied by actual airborne duration recorded from live transponder telemetry.
- **Zero Custody (1inch Aqua)**: Airline USDC stays in the corporate treasury until the exact second of landing. Funds are never locked in escrow.
- **Autonomous Gasless Micropayments (Circle Agent Stack on Arc)**: An autonomous Circle Agent Wallet settles the offset on Arc Testnet via Circle Gateway Nanopayments with sub-second finality.
- **Enterprise Web3 Authorization (Privy)**: Dispatchers authenticate with their Web3 wallet and delegate a bounded session policy (budget ceiling and whitelist) to the agent.
- **Immersive Operations Console**: Styled in **Copperx** minimal fintech aesthetics (`#4C63ED` electric indigo, slate obsidian `#0B0F19`) featuring a **Windy.com-inspired** live global aircraft radar map.

---

## 2. Targeted Partner Tracks & Irreplaceable Roles

| Partner | Role | Technical Primitive |
|---|---|---|
| **1inch Aqua** | Non-Custodial Liquidity | Shared liquidity pool where airline USDC remains in wallet until settlement. Atomic `aqua.pull(treasury, usdc)` and `aqua.push(treasury, offset)` on touchdown. Optional SwapVM short vs long-haul rate tier. |
| **Circle Agent Stack (Arc)** | Autonomous Economic Engine | Circle Agent Wallet with policy rules (daily spend cap & contract whitelist) settling Wheels-Down as native USDC Nanopayments via Circle Gateway on Arc Testnet (Chain ID `5042002`). |
| **Privy** | Dispatcher Identity & Governance | Corporate Web3 wallet connection and scoped session key delegation (whitelisting `SkyRouteVault`, capping per-flight budget, and enforcing expiry). |

---

## 3. UI/UX Architecture: Copperx Aesthetics + Windy.com Radar

### 3.1 Visual Design Language (Inspired by Copperx.io)
- **Canvas & Backgrounds**:
  - Main background: Deep obsidian `#0B0F19`
  - Elevated surfaces / cards: Slate glass `#121926`
  - Sub-surfaces: `#1E293B`
  - Borders: Clean hairline `border-white/10` or `border-slate-800`
- **Accent & Indicators**:
  - Primary Accent: **Copperx Electric Indigo** (`#4C63ED` / `#5B6EF5`)
  - Altitude/Cruise State: Clean icy cyan (`#06B6D4`)
  - Warning/Descent: Warm amber (`#F59E0B`)
  - Verified Settlement: Electric indigo glow (`#4C63ED`)
- **Typography & Details**:
  - Sans-serif UI with tight tracking (`tracking-[-0.02em]`)
  - `font-mono tabular-nums` for all telemetry, coordinates, and USDC amounts
  - Frosted pill badges (`bg-indigo-500/10 border border-indigo-500/20 text-indigo-400`)

### 3.2 Global Live Map (Inspired by Windy.com)
- **Interactive Dark Tile Canvas**: Dark vector basemap (CartoDB Dark Matter) with smooth pan, tilt, and zoom.
- **Live Aircraft Fleet**: Fetches real commercial aircraft from OpenSky Network's global ADS-B feed (`https://opensky-network.org/api/states/all`).
- **Windy-Style Directional Plane Vectors**:
  - Aircraft rendered as sleek directional SVG markers rotated to their actual `true_track` angle.
  - Interactive selection: Clicking any plane opens a glassmorphic avionics HUD card.
- **Dual-Mode Demo Switch**:
  - **Global Live Radar Mode (Windy Mode)**: Browse live commercial flights active across the world.
  - **Touchdown Replay Mode (Default for Demo)**: Streams a real recorded flight's final descent to runway touchdown, triggering `wheels-down` and the live ArcScan transaction on cue within 45–60 seconds.

---

## 4. Aviation Emissions Engine (Official ICAO Methodology)

Rather than an unverified physics formula, emissions are calculated using official **ICAO published aircraft category consumption tables**:

### 4.1 Aircraft Category Fuel Burn Benchmarks
| Category | Example Types | ICAO Average Hourly Burn |
|---|---|---|
| **Narrow-body** | Airbus A320 / Boeing 737 | $2,400\text{ kg/hour}$ ($0.667\text{ kg/sec}$) |
| **Wide-body** | Airbus A350 / Boeing 777 | $6,500\text{ kg/hour}$ ($1.806\text{ kg/sec}$) |
| **Regional Jet** | Embraer E190 / CRJ900 | $1,600\text{ kg/hour}$ ($0.444\text{ kg/sec}$) |
| **Heavy / Super** | Airbus A380 / Boeing 747 | $10,200\text{ kg/hour}$ ($2.833\text{ kg/sec}$) |

### 4.2 Wheels-Down Settlement Calculation
1. **Airborne Duration**:
   $$\Delta t = t_{\text{touchdown}} - t_{\text{takeoff}} \quad (\text{seconds})$$
2. **Total Fuel Burned**:
   $$\text{Fuel (kg)} = \left(\frac{\Delta t}{3600}\right) \times \text{Hourly Burn Rate}_{\text{category}}$$
3. **Total $CO_2$ Emitted (ICAO Doc 9889 Factor)**:
   $$\text{CO}_2\text{ (kg)} = \text{Fuel (kg)} \times 3.16$$
4. **Carbon Offset Cost in USDC (6 Decimals)**:
   $$\text{USDC Amount} = \left(\frac{\text{CO}_2\text{ (kg)}}{1000}\right) \times \text{Price Per Tonne USDC}$$

---

## 5. Smart Contract Architecture (Foundry & Arc Testnet)

### 5.1 `SkyRouteVault.sol`
Deployed to Arc Testnet (`Chain ID 5042002`, Native Gas: USDC).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IAqua {
    function pull(address from, uint256 amount) external;
    function push(address to, uint256 amount) external;
}

contract SkyRouteVault {
    address public immutable aqua;
    address public immutable usdc;
    address public owner;
    
    struct FlightManifest {
        string callsign;
        string aircraftCategory;
        address treasury;
        uint256 maxBudgetUSDC;
        bool settled;
    }

    mapping(bytes32 => FlightManifest) public manifests;
    mapping(address => bool) public authorizedAgents;

    event FlightManifestRegistered(bytes32 indexed flightId, string callsign, address treasury, uint256 maxBudget);
    event WheelsDownSettled(bytes32 indexed flightId, string callsign, uint256 airborneSeconds, uint256 co2Kg, uint256 usdcAmount);

    modifier onlyAgent() {
        require(authorizedAgents[msg.sender], "Unauthorized agent");
        _;
    }

    constructor(address _aqua, address _usdc) {
        aqua = _aqua;
        usdc = _usdc;
        owner = msg.sender;
    }

    function registerFlightManifest(
        string calldata callsign,
        string calldata aircraftCategory,
        address treasury,
        uint256 maxBudgetUSDC
    ) external returns (bytes32 flightId) {
        flightId = keccak256(abi.encodePacked(callsign, treasury, block.timestamp));
        manifests[flightId] = FlightManifest(callsign, aircraftCategory, treasury, maxBudgetUSDC, false);
        emit FlightManifestRegistered(flightId, callsign, treasury, maxBudgetUSDC);
    }

    function settleWheelsDown(
        bytes32 flightId,
        uint256 airborneSeconds,
        uint256 fuelBurnKg,
        uint256 co2Kg,
        uint256 usdcAmount
    ) external onlyAgent {
        FlightManifest storage manifest = manifests[flightId];
        require(!manifest.settled, "Already settled");
        require(usdcAmount <= manifest.maxBudgetUSDC, "Exceeds flight budget");

        manifest.settled = true;

        // Zero-custody Aqua settlement: pull USDC from treasury and push carbon credits
        IAqua(aqua).pull(manifest.treasury, usdcAmount);
        IAqua(aqua).push(manifest.treasury, co2Kg);

        emit WheelsDownSettled(flightId, manifest.callsign, airborneSeconds, co2Kg, usdcAmount);
    }
}
```

---

## 6. Circle Agent Stack & Nanopayments on Arc

1. **Circle Agent Wallet Configuration**:
   - The autonomous dispatcher runs as a registered Circle Agent Wallet.
   - Enforces Circle Policy Engine rules:
     - Allowlist destination address: `SkyRouteVault`
     - Per-transaction cap: Max `500 USDC`
     - Daily allowance limit: `5,000 USDC`
2. **Nanopayment Settlement via Circle Gateway**:
   - Native USDC settlement on Arc Testnet (`https://arc-testnet.drpc.org`).
   - 100% gasless transaction broadcast via Circle Gateway.
   - Sub-second block confirmation with verifiable explorer receipt on `testnet.arcscan.app`.

---

## 7. Dispatcher Identity & Bounded Delegation (Privy)

1. **Web3 Wallet Connection**:
   - Airline dispatcher connects corporate treasury wallet via `@privy-io/react-auth`.
2. **Scoped Session Delegation**:
   - Dispatcher signs a bounded session grant:
     - Target contract: `SkyRouteVault`
     - Flight budget ceiling: `250 USDC`
     - Expiry: Flight ETA + 2 hours.
   - Eliminates all wallet popups during landing.

---

## 8. End-to-End System Workflow

```
[1. Dispatcher connects Web3 Wallet & signs flight manifest policy]
                          │
                          ▼
[2. Flight is tracked in Console (Windy Live Fleet or Replay Approach)]
                          │
                          ▼
[3. Transponder signals touchdown: prev.onGround == false, curr.onGround == true]
                          │
                          ▼
[4. Circle Agent computes ICAO emissions: duration x hourlyBurn x 3.16]
                          │
                          ▼
[5. Circle Agent Wallet executes Nanopayment to SkyRouteVault on Arc]
                          │
                          ▼
[6. 1inch Aqua executes atomic pull(treasury, USDC) & push(treasury, carbonCredits)]
                          │
                          ▼
[7. Console triggers Sonner toast with verified ArcScan link]
```

---

## 9. Verification & Testing Plan

1. **Smart Contracts (Foundry)**:
   - Fork tests on live Arc Testnet: `forge test --fork-url https://arc-testnet.drpc.org -vvv`.
   - Invariant: Airline treasury balance remains zero-escrow until `settleWheelsDown`.
   - Invariant: Reverts if `usdcAmount > maxBudgetUSDC`.
2. **Emissions & Telemetry Agent (Vitest)**:
   - Unit tests for ICAO benchmark table lookups and Wheels-Down duration calculations.
   - Integration tests streaming real flight replay data and verifying `wheels-down` event emission.
   - Live query test to OpenSky Network API asserting real global aircraft positions.
3. **Frontend & Console (Next.js 15)**:
   - Web3 wallet connect & session key grant verification.
   - Windy-style Leaflet map rendering active flight vectors.
   - Replay scrub controls triggering simulated touchdown and Sonner transaction alerts.
