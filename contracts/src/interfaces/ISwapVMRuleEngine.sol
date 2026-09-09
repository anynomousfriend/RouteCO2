// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title ISwapVMRuleEngine
/// @notice Interface for the 1inch SwapVM flight fuel-efficiency curve engine
interface ISwapVMRuleEngine {
    /// @notice Evaluates flight fuel burn and carbon offset cost from SwapVM bytecode curve instructions
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
    ) external pure returns (
        uint256 finalFuelBurnKg,
        uint256 co2Kg,
        uint256 offsetCostUSDC
    );

    /// @notice Validates that SwapVM bytecode contains only valid supported opcodes
    /// @param bytecode Bytecode to validate
    /// @return bool True if valid, false otherwise
    function validateBytecode(bytes calldata bytecode) external pure returns (bool);
}
