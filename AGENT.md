# AGENT PROTOCOL & OPERATIONAL RULES: ETHONLINE 2026 (SKYROUTE)

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS & CODING ASSISTANTS:**
> This document is the supreme operational specification and binding rulebook for this repository. Every instruction, rule, and constraint herein is NON-NEGOTIABLE.
> Violating any mandate—especially the Zero-Mock rule, the Spec-Driven Development workflow, or the autonomous git commit ban—is an immediate catastrophic failure.

---

## 1. Non-Negotiable Core Directives

### 1.1 Strict Zero-Mock & No-Simulate Mandate (ABSOLUTE BAN)
- **NO MOCK DATA**: Never create hardcoded arrays or JSON files representing blockchain state, order books, balances, trades, or flight telemetry.
- **NO FAKE DELAYS / TIMEOUTS**: Never use `setTimeout`, `sleep`, or artificial delays to simulate network latency, API response times, or block confirmations.
- **NO SIMULATED BALANCES OR TRANSACTIONS**: Never synthesize transaction hashes (`0x123...`), mock balances, or dummy wallet states using `Math.random` or pseudo-random generators.
- **NO MOCK TOKEN CONTRACTS**: Never deploy or use mock ERC-20 tokens (`ERC20Mock`, `TestToken`). Use real testnet USDC (native gas & token on Arc Testnet, Circle Faucet) and real testnet USDC on Base Sepolia (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`).
- **NO SILENT MOCK FALLBACKS**: Under NO circumstances may code catch an RPC, API, or network error and return a fallback dummy value, cached mock, or default simulation (`try { fetch() } catch { return MOCK_DATA }` is STRICTLY BANNED). If a network call fails or credentials are missing, the function MUST throw an explicit, fatal error.
- **NO TEST MOCKING LIBRARIES**: The use of `vi.mock()`, `jest.mock()`, `jest.fn()`, `sinon`, `nock`, `msw` (Mock Service Worker), or any stubbing framework for on-chain interactions or API endpoints is STRICTLY PROHIBITED. All integration tests must hit live testnet endpoints or live RPC forks.
- **NO INITIAL PLACEHOLDER STATE IN UI**: React state for balances, flight telemetry, avionics gauges, and settlement logs MUST initialize to empty/null or skeleton loaders (`isLoading: true`). State may ONLY be populated via live RPC hooks (`viem`, `wagmi`, Arc drpc client) or live OpenSky ADS-B queries.
- **LIVE RPC & PRODUCTION API BINDINGS ONLY**:
  - Every blockchain read MUST query live RPCs (Arc Testnet, Base Sepolia).
  - Every flight avionics read MUST query real-time OpenSky Network ADS-B telemetry (`opensky-network.org`).
  - Every write MUST broadcast real transactions to live testnets and return verifiable transaction hashes with block explorer URLs (`testnet.arcscan.app`, `sepolia.basescan.org`).
- **REAL INTEGRATION TESTS ONLY**:
  - Foundry tests must execute against real testnet endpoints or live RPC forks (`forge test --fork-url $ARC_RPC_URL` or `$BASE_SEPOLIA_RPC_URL`).
  - Agent and backend tests (Vitest) must make real network calls to OpenSky and assert real decoded on-chain data.
- **NO DUMMY ADAPTERS**: If an external API key or RPC is unavailable, fail loudly with an informative error instructing the human partner to provide the missing credential in `.env`. Do NOT fall back to dummy mock data.

### 1.2 Interface-Driven Development Workflow
Every feature, module, contract, or endpoint must strictly follow this four-stage lifecycle:
1. **Interface First**: Confirm TypeScript types and Solidity interfaces directly from Section 4 of `AGENT.md` before authoring any implementation code.
2. **Integration Test First**: Author the test suite asserting real RPC/API interactions and expected state changes BEFORE writing business logic.
3. **Lean Implementation**: Author the minimal, robust code necessary to fulfill the specification and pass real tests. No dead code, no speculative abstractions, no bloated dependencies.
4. **Live Verification**: Run test suites against live RPCs and capture verifiable transaction hashes and receipts.

### 1.3 Pull-Based SDK Lookup (MANDATORY — NO RE-DOCUMENTATION)
- **NEVER re-document an SDK in comments or notes.** We describe OUR interfaces, not theirs.
- **NEVER trust cached or memorized API shapes.** SDK APIs change between versions. Always verify against ground truth before using any SDK method.
- **ALWAYS pull from ground-truth sources** when you need to use an SDK function:

  | Stack | Ground-Truth Source | Lookup Method |
  |---|---|---|
  | **1inch SwapVM** | `github.com/1inch/swap-vm/src/` | Read raw Solidity from GitHub; after `forge install`, read from `lib/swap-vm/` |
  | **1inch Aqua** | `@1inch/aqua` (Foundry dep) | Read `IAqua.sol` from `lib/aqua/src/interfaces/` after install |
  | **Circle SDK** | `node_modules/@circle-fin/developer-controlled-wallets/dist/` | Read `.d.ts` type definitions after `npm install` |
  | **Privy** | `search_privy_docs` MCP tool | Query the MCP tool for any Privy question — it returns live docs |
  | **Privy SDK types** | `node_modules/@privy-io/react-auth/dist/` | Read `.d.ts` type definitions after `npm install` |
  | **OpenSky Network** | `https://opensky-network.org/api/states/all` | Live public ADS-B REST endpoint |

- **Lookup workflow for every SDK call:**
  1. Check the table above for the ground-truth source
  2. Read the real types/source from that source
  3. Use verified function signatures in implementation
  4. If a function doesn't exist in the real source, it's hallucinated — DO NOT USE IT


### 1.4 Strict Human-in-the-Loop Git Hygiene
- **NEVER RUN `git commit` AUTONOMOUSLY**: You are strictly prohibited from executing `git commit` without explicit human authorization.
- **Verification Gate**: A commit can ONLY be proposed after all tests pass on live RPC forks and verifiable evidence is provided.
- **Approval Protocol**:
  1. Complete feature and verify all automated tests pass against live networks.
  2. Present the exact test output and live explorer verification link to the human partner.
  3. Prompt explicitly:
     > *"Feature [Name] is implemented and verified against live RPC/API. Ready for review. Would you like me to commit these changes with message: '<type>(<scope>): <concise imperative message>'?"*
  4. Only run `git add` and `git commit` upon explicit, affirmative confirmation from the human partner.
- **Commit History**: Frequent, progressive, atomic commits documenting real development stages throughout the hackathon. Single-commit dumps result in immediate disqualification.
- **Strict Staging Hygiene**: Never stage `.env`, private keys (`DEPLOYER_PRIVATE_KEY`, `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `PRIVY_APP_SECRET`), or temporary build artifacts. Always review `git status` prior to proposing a commit.

### 1.5 Superpowers Skill-Driven Engineering Mandates
All agent operations and feature implementations must actively utilize the installed Superpowers skills:
- **Test-Driven Development (`test-driven-development`)**: Author integration tests asserting live RPC/API behavior and observe them fail BEFORE authoring business logic.
- **Systematic Debugging (`systematic-debugging`)**: When encountering any test failure, compile error, or RPC revert, conduct structured root-cause analysis before proposing or applying fixes. No speculative or random code patching.
- **Verification Before Completion (`verification-before-completion`)**: NEVER claim a task or feature is complete, fixed, or passing without executing the exact verification command (`forge test`, `npm test`, `npm run build`) and confirming raw output evidence.
- **Subagent Task Execution (`subagent-driven-development`, `dispatching-parallel-agents`)**: Dispatch specialized subagents with clean scopes and independent tasks when appropriate to protect context budget.
- **Design & UI Polish (`emil-design-eng`, `ask-sonner`, `privy`)**: Strictly apply Emil Kowalski motion rules, Sonner lifecycle toasts for transactions, and Privy embedded wallet patterns.

---

## 2. ETHGlobal Hackathon Submission Rules & Criteria

All project deliverables must comply with official ETHOnline 2026 hackathon governance:
- **Submission Deadline**: Sunday, September 13th, 2026 at 09:00 AM EDT.
- **Partner Prize Limit**: Maximum of 3 Partner Prizes selected in Hacker Dashboard.
- **Video Demo Mandates**:
  - Length: Strictly between 2 and 4 minutes (videos < 2 min or > 4 min fail upload).
  - Resolution: Minimum 720p.
  - Audio: Real human narration only. Strictly NO AI voiceovers / text-to-speech, NO mobile phone recordings, NO sped-up clips.
  - Structure: Brief problem intro (<20s), followed immediately by live product walkthrough demonstrating live on-chain transactions and agent actions.
- **Originality & Code Governance**: All core code authored during the hackathon window. Open-source dependencies and starter kits disclosed in `README.md`.
- **Public Repository**: Public GitHub repo with open-source license (MIT/Apache-2.0) and progressive commit history.
- **AI Tool Disclosure**: Document all AI prompts, specifications, and workflows in `README.md` and `specs/`.
- **Judging Criteria Alignment**:
  - *Technicality*: Real-world ICAO fuel-burn telemetry integrated with SwapVM bytecode curve execution and autonomous agent settlement.
  - *Originality*: First protocol bridging live aviation transponder telemetry (ADS-B) directly to zero-custody on-chain carbon exchange.
  - *Practicality*: Solves the opaque \$2B corporate carbon-offset market with real-time, verified flight-by-flight emissions reconciliation.
  - *Usability (UI/UX/DX)*: High-tech Flight Operations Command Center aesthetic (Supabase dark `#121212`, emerald `#3ecf8e`, live radar map, Geist Mono tabular-nums).
  - *WOW Factor*: Watching a real airplane in the sky cross a waypoint and trigger an autonomous zero-gas on-chain offset settlement on ArcScan.

---

## 3. Targeted Partner Tracks & Irreplaceable Tech Alignment

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIVY (Identity & UX)                           │
│  - Corporate Flight Operations & Dispatcher Passkey Onboarding         │
│  - Non-Custodial Embedded Smart Wallet (Zero seed phrase)              │
│  - Scoped Flight Manifest Session Keys (Bounded daily flight budget)   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   1INCH AQUA (Shared Liquidity Layer)                  │
│  - Zero-Custody: Airline treasury USDC remains in wallet (No escrow)   │
│  - SwapVM Bytecode: Dynamic fuel-efficiency pricing curve opcodes      │
│  - ICAO Dynamic Curve: Cruise altitude discount vs climb rate scale    │
│  - Atomic Settlement: aqua.pull() USDC & aqua.push() offset credits    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CIRCLE AGENT STACK ON ARC (Economic OS)               │
│  - Autonomous Flight Dispatcher Daemon (Evaluates live OpenSky ADS-B) │
│  - Sub-second Finality & Native USDC Gas (Chain ID 5042002)            │
│  - Programmable Circle Paymaster (100% Gasless flight operations)      │
│  - Automated Micro-Bounties & Waypoint Touchdown Settlements           │
└────────────────────────────────────────────────────────────────────────┘
```

### Track 1: 1inch — Build an Aqua App
- **Core Role**: Dynamic Emission Pricing & Zero-Custody Execution.
- **Mandatory Qualifications**:
  1. **SwapVM Engine**: Off-chain compiled bytecode instructions (`_piecewiseLinearScale`, `_flatFeeAmountInXD`, `_decayXD`) reflecting aircraft fuel burn rates.
  2. **Live On-Chain Transfers**: Atomic settlement via `AquaSwapVMRouter` executing `aqua.pull()` (USDC from corporate treasury) and `aqua.push()` (counter-asset/carbon credits) in the same transaction.
  3. **Zero-Custody Shared TVU**: Airline's USDC remains in self-custody while virtually quoted across flight legs via `aqua.ship()`.
  4. **Strict Invariant Verification**: `exactIn(X) == exactOut(Y)` symmetry and maker-favorable rounding.

### Track 2: Arc / Circle — Best Agentic Economy with Circle Agent Stack
- **Core Role**: Autonomous Flight Dispatcher & Economic Coordination.
- **Mandatory Qualifications**:
  1. **Circle Agent Stack**: Autonomous background worker polling live OpenSky ADS-B radar feeds.
  2. **Real Environmental Signals**: Ingests real aircraft altitude, ground speed, and vertical climb rates to evaluate ICAO emission formulas.
  3. **USDC Micropayments on Arc**: Settles waypoint carbon-offset tranches natively in USDC on Arc Testnet (`5042002`).
  4. **Circle Paymaster**: 100% gasless execution so flight operators interact without gas-token management.

### Track 3: Privy — Seamless Onboarding & User Experience
- **Core Role**: Enterprise Flight Dispatcher Portal & Bounded Security.
- **Mandatory Qualifications**:
  1. **Privy SDK Foundation**: Dispatchers log in via `@privy-io/react-auth` in < 3 seconds using Passkeys/FaceID.
  2. **Embedded Smart Wallets**: Provisioned automatically for corporate operations.
  3. **Scoped Session Delegation**: Dispatcher grants bounded session key:
     - *Contract Whitelist*: Restricted strictly to `SkyRouteVault` and Arc USDC.
     - *Flight Budget Cap*: Maximum daily or per-flight delta (e.g. 500 USDC).
     - *Flight Manifest Expiry*: Time-bounded (e.g. 8 hours) with 1-click immediate emergency abort.
  4. **Frictionless UX**: Zero wallet popups during mid-flight waypoint settlements.

---

## 4. End-to-End System Architecture & Core Interfaces

```
                               ┌────────────────────────────────────────────────────────┐
                               │           FLIGHT OPERATIONS CONSOLE (Next.js 15)       │
                               │    NASA/Aviation Dark Design (#121212 + #3ecf8e)       │
                               │    Live Radar Map + Avionics Telemetry HUD             │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                 1. Onboard (Passkey) & Grant Flight Manifest Session
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │                  PRIVY IDENTITY LAYER                  │
                               │  - Embedded Corporate Smart Wallet                     │
                               │  - Policy Guards: Whitelist (SkyRouteVault), Cap       │
                               │  - Zero Seed-Phrase Friction                           │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                 2. Autonomous Dispatch Pipeline (Zero Popups)
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             CIRCLE AGENT STACK ON ARC                                                   │
│  - Autonomous Flight Dispatcher Daemon (agent/src/dispatcher.ts)                                                        │
│  - Signal Polling: Ingests live ADS-B radar telemetry from OpenSky Network (Altitude, Speed, Climb Rate)              │
│  - ICAO Fuel Burn Engine: Computes exact instantaneous fuel consumption and CO2 output                                  │
│  - Micro-Settlement: Broadcasts offset settlements on Arc Testnet via Circle Paymaster (Gasless)                        │
└─────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────┘
                                              │
                    3. Compiles dynamic fuel-efficiency curve into SwapVM Bytecode via aqua.ship()
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                            1INCH AQUA & SWAPVM LAYER                                                    │
│                                                                                                                         │
│   ┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────────┐    │
│   │           1inch Aqua Core Registry           │              │             SwapVM Execution Router              │    │
│   │  - Zero-Custody: USDC stays in airline wallet│              │  - Runs compiled fuel-efficiency bytecode        │    │
│   │  - Virtual TVU: Backs flight manifest offsets│◄────────────►│  - Enforces cruise-discount & climb-rate math    │    │
│   │  - Calls aqua.pull() & aqua.push() on fill   │              │  - Atomic settlement without fund lockup         │    │
│   └──────────────────────────────────────────────┘              └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Core Solidity Interfaces
```solidity
// contracts/src/interfaces/ISkyRouteVault.sol
interface ISkyRouteVault {
    function registerFlightManifest(
        string calldata callsign,
        address tokenIn,
        address tokenOut,
        uint256 maxBudget,
        bytes calldata swapVmBytecode
    ) external returns (bytes32 flightId);

    function settleWaypointOffset(
        bytes32 flightId,
        uint256 fuelBurnKg,
        uint256 carbonKg,
        uint256 paymentAmount
    ) external;

    function aquaAppSwapCallback(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut,
        bytes calldata data
    ) external;
}
```

### 4.2 ICAO Emissions & SwapVM Bytecode Architecture
Instantaneous fuel burn formula:
$$\text{Fuel Burn Rate} = f(\text{Alt}, \text{Speed}, \text{ClimbRate})$$
$$\text{CO}_2\text{ emitted (kg)} = \text{Fuel Burn (kg)} \times 3.16$$

SwapVM Opcode Pipeline:
```
[Base Fuel Allocation: _dynamicBalancesXD / _staticBalancesXD]
  └── [Altitude Efficiency Curve: _piecewiseLinearScale (Cruise Discount)]
        └── [Dynamic Carbon Offset Fee: _flatFeeAmountInXD]
              └── [Waypoint Settlement Decay: _decayXD]
```

---

## 5. UI/UX Craft: Flight Operations Command Center + Emil Kowalski Polish

### 5.1 Visual Aesthetic
- **Canvas / Background**: Deep cockpit dark `#121212` (sub-surface `#171717`, elevated `#1c1c1c`).
- **Grid Pattern**: Micro dot-grid radar overlay (`bg-grid-pattern`).
- **Accent**: Supabase Emerald `#3ecf8e` (radar pings, active waypoints, confirmed status).
- **Secondary Warning**: High-contrast amber `#f59e0b` (for climb thrust or altitude deviations).
- **Typography**: Clean sans-serif UI with `font-mono tabular-nums` strictly enforced for all avionics dials, altitudes, speeds, fuel burn numbers, and hashes.

### 5.2 Emil Kowalski Interaction Rules
1. **Never use `transition: all`**: Animate explicit properties (`transform`, `opacity`, `stroke-dashoffset`).
2. **Never scale from 0**: Elements entering the viewport animate from `scale(0.95)` with `opacity: 0`.
3. **Tactile Radar Buttons**: `active:scale-[0.98]` on all flight controls.
4. **0ms Keyboard Latency**: Instantaneous flight search and waypoint inspect shortcuts.
5. **Sonner Toasts**: Real-time waypoint settlement lifecycles with direct links to `testnet.arcscan.app`.

---

## 6. Repository Layout

```
/home/subhankar/Development/EthOnline2026/
├── contracts/                  # Foundry Smart Contract Suite (Zero-Mock)
│   ├── src/
│   │   ├── SkyRouteVault.sol   # Custom Aqua App callback contract hooking into SwapVM
│   │   ├── SwapVMRuleEngine.sol# SwapVM flight curve builder & verification
│   │   └── interfaces/         # IAqua.sol and ISkyRouteVault.sol
│   ├── test/                   # Real RPC Fork & Testnet Integration Tests
│   └── foundry.toml            # Foundry configuration (solc 0.8.26+, Arc testnet RPC)
├── agent/                      # Autonomous Flight Dispatcher (Circle Agent Stack)
│   ├── src/
│   │   ├── dispatcher.ts       # OpenSky ADS-B poller & flight monitor loop
│   │   ├── icao-engine.ts      # Aviation fuel burn & CO2 emissions calculator
│   │   ├── circle-wallet.ts    # Circle Developer-Controlled Wallet manager
│   │   ├── swapvm-compiler.ts  # Compiles dynamic flight curve to SwapVM bytecode
│   │   └── arc-settler.ts      # Native USDC micropayments via Circle Paymaster
│   └── test/                   # Vitest live tests against OpenSky API and Arc RPC
├── web/                        # Next.js 15 Flight Operations Command Center
│   ├── app/                    # Layout with PrivyProvider, Sonner Toaster, Ops Console
│   ├── components/             # FlightRadarMap, AvionicsHUD, PricingCurveVisualizer, FlightControls
│   └── lib/                    # OpenSky client, Privy session client, Arc RPC client
├── .env.example                # Canonical environment template
├── AGENT.md                    # Primary operational protocol & agent rules
├── AGENTS.md                   # Symlink to AGENT.md (Codex / Claude Code context auto-loader)
├── GEMINI.md                   # Symlink to AGENT.md (Antigravity / Gemini CLI context auto-loader)
└── README.md                   # Public project showcase & track qualification documentation
```

---

## 7. Environment & Live Network References

### OpenSky Network (Live ADS-B Flight Telemetry)
- **API Base**: `https://opensky-network.org/api`
- **Live States**: `GET https://opensky-network.org/api/states/all`
- **Fields**: `[icao24, callsign, origin_country, time_position, last_contact, longitude, latitude, baro_altitude, on_ground, velocity, true_track, vertical_rate]`

### Arc Testnet (Circle L1)
- **Chain ID**: `5042002` (`0x4cef52`)
- **Native Gas Token**: USDC
- **Public RPC**: `https://arc-testnet.drpc.org`
- **Block Explorer**: `https://testnet.arcscan.app`

### Base Sepolia Testnet
- **Chain ID**: `84532`
- **Public RPC**: `https://sepolia.base.org`
- **Circle USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

---

## 8. Development Commands & Verification Checklist

### Smart Contracts (Foundry)
```bash
# Build contracts
forge build

# Run tests against live Arc Testnet fork (ZERO MOCKS)
forge test --fork-url https://arc-testnet.drpc.org -vvv

# Deploy contract to Arc Testnet
forge create src/SkyRouteVault.sol:SkyRouteVault \
  --rpc-url https://arc-testnet.drpc.org \
  --private-key $DEPLOYER_PRIVATE_KEY
```

### Autonomous Dispatcher Agent
```bash
# Run agent tests against live OpenSky API and Arc RPC
cd agent && npm test

# Launch autonomous flight dispatcher
cd agent && npm start
```

### Web Command Center
```bash
# Launch Next.js ops console
cd web && npm run dev
```
