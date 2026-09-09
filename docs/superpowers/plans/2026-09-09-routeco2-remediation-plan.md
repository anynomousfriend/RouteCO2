# Implementation & Remediation Plan: RouteCO2 Full Alignment

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all audit findings, interface divergences, and Zero-Mock compliance violations across Smart Contracts, Agent Dispatcher, Web API, and Frontend, restoring 100% fidelity to `AGENT.md` specifications and partner track requirements.

**Architecture:**
- **Track 1 (1inch Aqua / SwapVM):** Implement `SwapVMRuleEngine.sol` and `swapvm-compiler.ts` to compile dynamic flight fuel-efficiency curves into SwapVM bytecode. Upgrade `AquaCore.sol` to strictly conform to `@1inch/aqua` interfaces (`IAqua.sol`, atomic `pull`/`push`, and `aquaAppSwapCallback`). Add native fund recovery to `SkyRouteVault.sol`.
- **Track 2 (Arc / Circle Agent Stack):** Implement `circle-wallet.ts` and `arc-settler.ts` for autonomous agent execution. Eliminate static `replay-flight.json` files in favor of dynamic OpenSky live/historical API streaming.
- **Track 3 (Privy):** Implement user-facing Scoped Flight Manifest Session Delegation UI (`SessionDelegationModal.tsx`) with bounded budget caps ($500 USDC), `SkyRouteVault` target whitelist, and 1-click abort.
- **UI/UX & Code Integrity:** Eliminate silent mock fallbacks in API routes, replace all `transition-all` with explicit CSS transitions, fix hardcoded gas and address strings, and wire live avionics calculations.

**Tech Stack:** Solidity 0.8.26, Foundry, Next.js 15, React 19, Viem 2.23, Privy React Auth 2.4, OpenSky Network ADS-B API, Arc Testnet (Chain ID 5042002).

**Spec References:** [`AGENT.md`](file:///home/subhankar/Development/EthOnline2026/AGENT.md), [`GEMINI.md`](file:///home/subhankar/Development/EthOnline2026/GEMINI.md).

---

## User Review Required

> [!IMPORTANT]
> **Key Architectural Adjustments in this Plan:**
> 1. **Contract Redeployment Required on Arc Testnet**: Adding SwapVM bytecode registration, `aquaAppSwapCallback`, and `withdrawFees` recovery functions requires deploying an upgraded `SkyRouteVault` and `SwapVMRuleEngine` instance to Arc Testnet (`5042002`). The deployer key in `.env` will broadcast these transactions and update `.env` and `web/.env.local`.
> 2. **Replay Mode Architecture**: Static JSON telemetry files (`recorded-flights/*.json` and `replay-flight.json`) violate GEMINI.md Rule 1.1. We replace them with a dynamic OpenSky track endpoint (`/api/replay-flight?callsign=...`) that fetches verified historical tracks from OpenSky REST endpoints on demand, with in-memory caching rather than static mock files on disk.
> 3. **Privy Session Delegation**: To maintain frictionless autonomous settlements while honoring Track 3 criteria, the dispatcher creates a bounded session permit stored in client state, explicitly passing authorization signatures to `/api/settle` where the authorized agent submits the transaction.

---

## Proposed Changes & Tasks

### Task 1: Smart Contracts Remediation (`contracts/`)

**Files:**
- Create: [`contracts/src/SwapVMRuleEngine.sol`](file:///home/subhankar/Development/EthOnline2026/contracts/src/SwapVMRuleEngine.sol)
- Modify: [`contracts/src/interfaces/ISkyRouteVault.sol`](file:///home/subhankar/Development/EthOnline2026/contracts/src/interfaces/ISkyRouteVault.sol)
- Modify: [`contracts/src/interfaces/IAqua.sol`](file:///home/subhankar/Development/EthOnline2026/contracts/src/interfaces/IAqua.sol)
- Modify: [`contracts/src/SkyRouteVault.sol`](file:///home/subhankar/Development/EthOnline2026/contracts/src/SkyRouteVault.sol)
- Modify: [`contracts/src/AquaCore.sol`](file:///home/subhankar/Development/EthOnline2026/contracts/src/AquaCore.sol)
- Modify: [`contracts/test/SkyRouteVault.t.sol`](file:///home/subhankar/Development/EthOnline2026/contracts/test/SkyRouteVault.t.sol)
- Create: [`contracts/test/SwapVMRuleEngine.t.sol`](file:///home/subhankar/Development/EthOnline2026/contracts/test/SwapVMRuleEngine.t.sol)

**Interfaces:**
- Consumes: `IAqua.sol` specification from `@1inch/aqua`.
- Produces: `ISkyRouteVault` with `swapVmBytecode` registration, `settleWheelsDown`, `withdrawFees`, and `aquaAppSwapCallback`.

- [ ] **Step 1: Write failing test for SwapVMRuleEngine & Upgraded SkyRouteVault**
  Create `contracts/test/SwapVMRuleEngine.t.sol` asserting SwapVM opcode validation, linear curve scaling for altitude efficiency, and `withdrawFees` functionality.
- [ ] **Step 2: Run test to verify failure**
  Run: `/home/subhankar/Development/EthOnline2026/bin/forge test --match-contract SwapVMRuleEngineTest`
  Expected: Revert/Fail due to missing contract.
- [ ] **Step 3: Implement `SwapVMRuleEngine.sol`**
  Implement the SwapVM flight efficiency curve interpreter supporting piecewise linear altitude discount (`_piecewiseLinearScale`) and climb-thrust scale factors.
- [ ] **Step 4: Update `ISkyRouteVault.sol` and `SkyRouteVault.sol`**
  - Add `bytes swapVmBytecode` to `FlightManifest` struct and `registerFlightManifest`.
  - Add `aquaAppSwapCallback(address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut, bytes calldata data)`.
  - Implement `withdrawFees(address payable to, uint256 amount) external onlyOwner` to safely sweep trapped native USDC.
  - Remove dead code (`fuelBurnKg;` no-op) and properly wire `usdc` token address for ERC-20 transfer validation.
- [ ] **Step 5: Upgrade `AquaCore.sol` & `IAqua.sol`**
  Upgrade `AquaCore.sol` to track virtual shared TVU, validate caller permissions, and support the official 1inch Aqua callback pattern.
- [ ] **Step 6: Run full Foundry suite and verify passes**
  Run: `/home/subhankar/Development/EthOnline2026/bin/forge test -vvv` and `/home/subhankar/Development/EthOnline2026/bin/forge test --fork-url https://arc-testnet.drpc.org -vvv`
  Expected: 100% tests PASS.

---

### Task 2: Agent Dispatcher & SwapVM Compiler (`agent/`)

**Files:**
- Create: [`agent/src/swapvm-compiler.ts`](file:///home/subhankar/Development/EthOnline2026/agent/src/swapvm-compiler.ts)
- Create: [`agent/src/circle-wallet.ts`](file:///home/subhankar/Development/EthOnline2026/agent/src/circle-wallet.ts)
- Create: [`agent/src/arc-settler.ts`](file:///home/subhankar/Development/EthOnline2026/agent/src/arc-settler.ts)
- Modify: [`agent/src/dispatcher.ts`](file:///home/subhankar/Development/EthOnline2026/agent/src/dispatcher.ts)
- Modify: [`agent/src/circle-agent.ts`](file:///home/subhankar/Development/EthOnline2026/agent/src/circle-agent.ts)
- Delete: [`agent/src/data/replay-flight.json`](file:///home/subhankar/Development/EthOnline2026/agent/src/data/replay-flight.json)
- Create: [`agent/test/swapvm-compiler.test.ts`](file:///home/subhankar/Development/EthOnline2026/agent/test/swapvm-compiler.test.ts)
- Create: [`agent/test/arc-settler.test.ts`](file:///home/subhankar/Development/EthOnline2026/agent/test/arc-settler.test.ts)

**Interfaces:**
- Consumes: ICAO fuel burn metrics from `icao-engine.ts`.
- Produces: Bytecode opcodes via `compileSwapVMCurve(profile)` and autonomous Arc settlement execution via `ArcSettler.settleOnArc()`.

- [ ] **Step 1: Write failing tests for SwapVM Compiler and Arc Settler**
  Author unit tests asserting bytecode opcodes, hex encoding, and Arc settlement transaction generation.
- [ ] **Step 2: Implement `swapvm-compiler.ts`**
  Implement off-chain bytecode compiler generating instructions for:
  - Base balance scaling
  - Altitude cruise discount (`_piecewiseLinearScale`)
  - Waypoint fee amount (`_flatFeeAmountInXD`)
- [ ] **Step 3: Implement `circle-wallet.ts` & `arc-settler.ts`**
  - Encapsulate Circle Agent wallet credential management and policy bounds.
  - Implement direct on-chain broadcasting on Arc Testnet (`arc-settler.ts`) with retry and receipt verification.
- [ ] **Step 4: Remove `agent/src/data/replay-flight.json` and refactor dispatcher**
  Replace static JSON loading with dynamic fetching from OpenSky API tracks (`https://opensky-network.org/api/tracks/all`) or live stream.
- [ ] **Step 5: Run agent test suite**
  Run: `cd agent && npm test`
  Expected: All tests pass.

---

### Task 3: Backend API Remediation (`web/app/api/`)

**Files:**
- Modify: [`web/app/api/settle/route.ts`](file:///home/subhankar/Development/EthOnline2026/web/app/api/settle/route.ts)
- Create: [`web/app/api/replay-flight/route.ts`](file:///home/subhankar/Development/EthOnline2026/web/app/api/replay-flight/route.ts)
- Delete: [`web/lib/recorded-flights/dlh400-frankfurt.json`](file:///home/subhankar/Development/EthOnline2026/web/lib/recorded-flights/dlh400-frankfurt.json)
- Delete: [`web/lib/recorded-flights/baw117-heathrow.json`](file:///home/subhankar/Development/EthOnline2026/web/lib/recorded-flights/baw117-heathrow.json)
- Delete: [`web/lib/recorded-flights/uae201-jfk.json`](file:///home/subhankar/Development/EthOnline2026/web/lib/recorded-flights/uae201-jfk.json)
- Delete: [`web/lib/recorded-flights/afr1248-cdg.json`](file:///home/subhankar/Development/EthOnline2026/web/lib/recorded-flights/afr1248-cdg.json)
- Delete: [`web/lib/replay-flight.json`](file:///home/subhankar/Development/EthOnline2026/web/lib/replay-flight.json)
- Modify: [`web/lib/replay-scenarios.ts`](file:///home/subhankar/Development/EthOnline2026/web/lib/replay-scenarios.ts)

- [ ] **Step 1: Fix silent mock fallback in `/api/settle`**
  Remove lines 225-227 in `web/app/api/settle/route.ts`:
  ```typescript
  // REMOVE: catch { totalCarbonOffsetKg = Math.floor(co2Kg).toString(); }
  // REPLACE WITH: throw new Error(`Failed to query totalCarbonOffsetKg: ${err.message}`)
  ```
- [ ] **Step 2: Implement dynamic `/api/replay-flight`**
  Build API endpoint that streams telemetry dynamically from OpenSky or generates real-time flight vectors without static JSON files on disk.
- [ ] **Step 3: Remove static JSON files from `web/lib/recorded-flights/`**
  Delete the 5 static JSON files to restore strict Zero-Mock compliance. Update `replay-scenarios.ts` to load flight tracks asynchronously from the dynamic endpoint.

---

### Task 4: Privy Scoped Session Delegation UI (Track 3)

**Files:**
- Create: [`web/components/SessionDelegationModal.tsx`](file:///home/subhankar/Development/EthOnline2026/web/components/SessionDelegationModal.tsx)
- Modify: [`web/components/NavigationDock.tsx`](file:///home/subhankar/Development/EthOnline2026/web/components/NavigationDock.tsx)
- Modify: [`web/lib/use-wallet-auth.ts`](file:///home/subhankar/Development/EthOnline2026/web/lib/use-wallet-auth.ts)
- Modify: [`web/app/page.tsx`](file:///home/subhankar/Development/EthOnline2026/web/app/page.tsx)

- [ ] **Step 1: Create `SessionDelegationModal.tsx`**
  Build dispatcher delegation modal displaying:
  - Whitelisted Target: `SkyRouteVault` (`0x2944c20d9aC1e9851BCd10E46ef2CAFe179267be`)
  - Max Flight Budget Cap: User-configurable (default 500 USDC)
  - Time Expiry: 8-hour session window with countdown
  - Emergency 1-click abort / revoke button
- [ ] **Step 2: Integrate into `NavigationDock.tsx`**
  Add a "Flight Policy & Delegation" button showing active session state (Active / Expired / Unbonded).
- [ ] **Step 3: Enforce session bounds in `page.tsx`**
  Before triggering `triggerWheelsDownSettlement`, assert that settlement value does not exceed the delegated budget cap.

---

### Task 5: UI/UX Craft & Emil Kowalski Compliance

**Files:**
- Modify: 9 component files with `transition-all`:
  - [`web/components/FlightMasterCard.tsx`](file:///home/subhankar/Development/EthOnline2026/web/components/FlightMasterCard.tsx)
  - [`web/components/DescentTimelineBar.tsx`](file:///home/subhankar/Development/EthOnline2026/web/components/DescentTimelineBar.tsx)
  - [`web/components/NavigationDock.tsx`](file:///home/subhankar/Development/EthOnline2026/web/components/NavigationDock.tsx)
  - [`web/app/page.tsx`](file:///home/subhankar/Development/EthOnline2026/web/app/page.tsx)
  - [`web/components/SettlementCertificateModal.tsx`](file:///home/subhankar/Development/EthOnline2026/web/components/SettlementCertificateModal.tsx)
  - [`web/components/AquaFlowVisualizer.tsx`](file:///home/subhankar/Development/EthOnline2026/web/components/AquaFlowVisualizer.tsx)
  - [`web/components/CommandSearchModal.tsx`](file:///home/subhankar/Development/EthOnline2026/web/components/CommandSearchModal.tsx)
  - [`web/components/FuelDynamicsBento.tsx`](file:///home/subhankar/Development/EthOnline2026/web/components/FuelDynamicsBento.tsx)
  - [`web/components/SettlementIntegrityBento.tsx`](file:///home/subhankar/Development/EthOnline2026/web/components/SettlementIntegrityBento.tsx)
- Modify: [`web/components/AquaInspectorModal.tsx`](file:///home/subhankar/Development/EthOnline2026/web/components/AquaInspectorModal.tsx)
- Modify: [`web/app/globals.css`](file:///home/subhankar/Development/EthOnline2026/web/app/globals.css)

- [ ] **Step 1: Replace all `transition-all` occurrences**
  Replace with explicit transitions (e.g. `transition-[transform,opacity] duration-140 ease-out`).
- [ ] **Step 2: Correct hardcoded addresses in `AquaInspectorModal.tsx`**
  Set `aquaAddress` to live deployed `AquaCore` address `0x6268472c27a6a25ab85713b51f1485c991f0cf9f`.
- [ ] **Step 3: Remove fallback `"68,836"` in `SettlementCertificateModal.tsx`**
  Render real gas receipt or dynamic skeleton loader.
- [ ] **Step 4: Fix `FlightMasterCard.tsx:193`**
  Render `liveHourlyBurn` when in live mode rather than hardcoded scenario hourly burn.
- [ ] **Step 5: Mount or integrate `FuelDynamicsBento.tsx` & `SettlementIntegrityBento.tsx`**
  Mount into the secondary drawer or inspection tab in `page.tsx` to eliminate dead code.

---

### Task 6: Live Deployment & Verification

- [ ] **Step 1: Deploy Upgraded Contracts to Arc Testnet**
  Run deployment script to deploy upgraded `SkyRouteVault` & `SwapVMRuleEngine`.
- [ ] **Step 2: Update environment configurations**
  Update contract addresses in `.env`, `contracts/.env`, and `web/.env.local`.
- [ ] **Step 3: Verify build and tests across full stack**
  - Contracts: `forge test --fork-url https://arc-testnet.drpc.org -vvv`
  - Agent: `npm test` in `agent/`
  - Web: `npm run build` in `web/`
- [ ] **Step 4: Live settlement end-to-end verification**
  Trigger live test flight settlement on Arc Testnet and verify transaction receipt on ArcScan.

---

## Verification Plan

### Automated Tests
1. **Foundry Smart Contract Tests**:
   - Command: `contracts/bin/forge test -vvv`
   - Command: `contracts/bin/forge test --fork-url https://arc-testnet.drpc.org -vvv`
   - Criteria: 100% pass including `SwapVMRuleEngine`, `withdrawFees`, and `aquaAppSwapCallback`.
2. **Agent Engine Vitest Suite**:
   - Command: `cd agent && npm test`
   - Criteria: 100% pass including `swapvm-compiler.test.ts` and `arc-settler.test.ts`.
3. **Frontend Next.js Build & Typecheck**:
   - Command: `cd web && npx tsc --noEmit && npm run build`
   - Criteria: Zero type errors, 0 lint errors, clean page bundle output.

### Live On-Chain & API Verification
1. **ArcScan Explorer Verification**:
   - Confirm contract deployment on `https://testnet.arcscan.app/address/<new_vault_address>`.
   - Confirm settlement transaction hash and event logs on ArcScan.
2. **OpenSky Network Authentication**:
   - Verify bearer token generation with `auth.opensky-network.org`.
3. **UI Interaction Verification**:
   - Open Command Center, verify 0ms latency on `⌘K`.
   - Test "Grant Flight Manifest Session" delegation modal.
   - Verify Sonner toast pops with active ArcScan transaction link upon settlement.
