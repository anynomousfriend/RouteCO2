# SkyRoute Smart Contracts (Foundry Suite)

SkyRoute smart contract layer deployed to Arc Testnet (`Chain ID 5042002`, Native Gas: USDC), implementing the **1inch Aqua Zero-Custody App** architecture.

## Overview

- **`SkyRouteVault.sol`**: Manages airline flight manifests and handles autonomous Wheels-Down settlements. When an authorized Circle Agent detects touchdown, it triggers `settleWheelsDown`, which executes zero-custody token settlement via 1inch Aqua (`aqua.pull` for USDC payment, `aqua.push` for counter-asset carbon credits).
- **`IAqua.sol`**: Minimal interface for 1inch Aqua core registry (`pull` and `push`).
- **`ISkyRouteVault.sol`**: Interface declaring data structures, events, and settlement methods.

## Zero-Custody Guarantee
Corporate airline treasury funds never leave self-custodial corporate wallets until touchdown. When the flight transponder signals touchdown (Wheels-Down), the Circle Agent triggers atomic settlement:
1. `IAqua(aqua).pull(treasury, usdcAmount)`
2. `IAqua(aqua).push(treasury, co2Kg)`

## Build & Test

```bash
# Build contracts
../bin/forge build

# Run test suite
../bin/forge test -vvv
```
