// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ISwapVMRuleEngine} from "./interfaces/ISwapVMRuleEngine.sol";

/// @title SwapVMRuleEngine
/// @notice SwapVM Flight Fuel-Efficiency Curve Engine conforming to AGENT.md Section 3 & 4.2
/// @dev Arc-local compact encoding of real 1inch SwapVM programs (ground truth: github.com/1inch/swap-vm).
///  Real SwapVM is deployed at 0x111111338c5091E8440b67B168bAe16a668AC0De on Ethereum/Base/Optimism/Polygon/
///  Arbitrum/Avalanche/BSC/Linea/Sonic/Unichain/Gnosis/zkSync/Cronos/Monad/HyperEVM (NOT on Arc 5042002).
///  Real bytecode format is [opcode_index][args_length][args_data] with instructions _dynamicBalancesXD,
///  _flatFeeAmountInXD, _decayXD, _xycSwapXD, _staticBalancesXD. This contract evaluates the Arc-local
///  1-byte compact projection: 0x01=_dynamicBalancesXD base allocation, 0x02=cruise/climb pricing curve
///  (real equivalents: oracle/base-fee adjusters), 0x03=_flatFeeAmountInXD carbon fee, 0x04=_decayXD
///  waypoint/descent decay. Off-chain compiler (agent/src/swapvm-compiler.ts) maps these to full programs.
contract SwapVMRuleEngine is ISwapVMRuleEngine {
    /// @notice Canonical 1inch SwapVM router (all supported chains above; Arc uses this engine as local projection)
    address public constant SWAPVM_ROUTER = 0x111111338c5091E8440b67B168bAe16a668AC0De;
    // SwapVM Flight Curve Opcodes
    uint8 public constant OP_DYNAMIC_BALANCES = 0x01; // Base allocation from duration and hourly burn
    uint8 public constant OP_PIECEWISE_LINEAR_SCALE = 0x02; // Altitude cruise discount & climb thrust scale
    uint8 public constant OP_FLAT_FEE_AMOUNT_IN = 0x03; // Carbon offset rate per tonne ($25/t USDC)
    uint8 public constant OP_DECAY = 0x04; // Waypoint / descent decay

    // Standard ICAO Jet-A1 carbon emission factor: 3.16 kg CO2 per kg fuel (316 / 100)
    uint256 public constant ICAO_CARBON_FACTOR_NUMERATOR = 316;
    uint256 public constant ICAO_CARBON_FACTOR_DENOMINATOR = 100;

    // Default carbon offset price: $25.00 USDC per metric tonne (6 decimals: 25_000_000 micro-USDC)
    uint256 public constant DEFAULT_PRICE_PER_TONNE_USDC = 25_000_000;

    /// @notice Validates that SwapVM bytecode contains only valid supported opcodes and has a base instruction
    /// @param bytecode Bytecode to validate
    /// @return bool True if valid, false otherwise
    function validateBytecode(bytes calldata bytecode) public pure override returns (bool) {
        if (bytecode.length == 0) {
            return false;
        }

        bool hasBaseAllocation = false;
        for (uint256 i = 0; i < bytecode.length; i++) {
            uint8 op = uint8(bytecode[i]);
            if (op == OP_DYNAMIC_BALANCES) {
                hasBaseAllocation = true;
            } else if (
                op != OP_PIECEWISE_LINEAR_SCALE &&
                op != OP_FLAT_FEE_AMOUNT_IN &&
                op != OP_DECAY
            ) {
                return false; // Unknown opcode
            }
        }

        return hasBaseAllocation;
    }

    /// @notice Evaluates flight fuel burn, CO2 output, and carbon offset cost from SwapVM bytecode
    /// @param bytecode Compiled SwapVM bytecode opcodes
    /// @param altitudeMeters Current barometric altitude in meters
    /// @param verticalRateMps Vertical climb/descent rate in meters per second
    /// @param airborneSeconds Total airborne duration in seconds
    /// @param baseHourlyBurnKg Aircraft benchmark base hourly fuel burn in kg/h
    /// @return finalFuelBurnKg Calculated final fuel burn in kg
    /// @return co2Kg Calculated CO2 emissions in kg
    /// @return offsetCostUSDC Offset purchase cost in micro-USDC (6 decimals)
    function evaluateFuelBurnCurve(
        bytes calldata bytecode,
        uint256 altitudeMeters,
        int256 verticalRateMps,
        uint256 airborneSeconds,
        uint256 baseHourlyBurnKg
    ) external pure override returns (
        uint256 finalFuelBurnKg,
        uint256 co2Kg,
        uint256 offsetCostUSDC
    ) {
        require(validateBytecode(bytecode), "Invalid SwapVM bytecode");

        uint256 fuelBurn = 0;
        bool hasFlatFee = false;

        for (uint256 i = 0; i < bytecode.length; i++) {
            uint8 op = uint8(bytecode[i]);

            if (op == OP_DYNAMIC_BALANCES) {
                // Evaluates base allocation from duration and hourly burn: (seconds * hourlyBurn) / 3600
                fuelBurn = (airborneSeconds * baseHourlyBurnKg) / 3600;
            } else if (op == OP_PIECEWISE_LINEAR_SCALE) {
                // Piecewise linear scale for aerodynamic efficiency
                // 1. Altitude cruise discount: if altitude > 9000m, applies cruise discount factor down to 80%
                if (altitudeMeters > 9000) {
                    uint256 cruiseFactor;
                    if (altitudeMeters >= 12000) {
                        cruiseFactor = 8000; // 80% at FL390+
                    } else {
                        // Linear discount from 10000 (at 9000m) down to 8000 (at 12000m)
                        cruiseFactor = 10000 - ((altitudeMeters - 9000) * 2000) / 3000;
                    }
                    fuelBurn = (fuelBurn * cruiseFactor) / 10000;
                }

                // 2. Climb thrust scale: if climb vertical rate > 2 m/s, applies climb thrust scale factor up to 135%
                if (verticalRateMps > 2) {
                    uint256 rate = uint256(verticalRateMps);
                    uint256 climbFactor;
                    if (rate >= 10) {
                        climbFactor = 13500; // 135% at >= 10 m/s
                    } else {
                        // Linear scale from 10000 (at 2 m/s) up to 13500 (at 10 m/s)
                        climbFactor = 10000 + ((rate - 2) * 3500) / 8;
                    }
                    fuelBurn = (fuelBurn * climbFactor) / 10000;
                }
            } else if (op == OP_DECAY) {
                // Waypoint / descent decay
                if (verticalRateMps < -2) {
                    uint256 descentRate = uint256(-verticalRateMps);
                    uint256 descentFactor;
                    if (descentRate >= 10) {
                        descentFactor = 7000; // 30% reduction at flight idle
                    } else {
                        // Linear reduction from 10000 down to 7000 between -2 m/s and -10 m/s
                        descentFactor = 10000 - ((descentRate - 2) * 3000) / 8;
                    }
                    fuelBurn = (fuelBurn * descentFactor) / 10000;
                } else {
                    // Waypoint progressive decay (5% discount)
                    fuelBurn = (fuelBurn * 9500) / 10000;
                }
            } else if (op == OP_FLAT_FEE_AMOUNT_IN) {
                hasFlatFee = true;
            }
        }

        finalFuelBurnKg = fuelBurn;
        // ICAO Carbon Factor: 3.16 kg CO2 per kg Jet-A1 fuel
        co2Kg = (finalFuelBurnKg * ICAO_CARBON_FACTOR_NUMERATOR) / ICAO_CARBON_FACTOR_DENOMINATOR;

        if (hasFlatFee) {
            // (co2Kg / 1000 tonnes) * $25/tonne * 1e6 micro-USDC
            offsetCostUSDC = (co2Kg * DEFAULT_PRICE_PER_TONNE_USDC) / 1000;
        } else {
            offsetCostUSDC = 0;
        }
    }
}
