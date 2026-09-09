// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SwapVMRuleEngine} from "../src/SwapVMRuleEngine.sol";
import {ISwapVMRuleEngine} from "../src/interfaces/ISwapVMRuleEngine.sol";

contract SwapVMRuleEngineTest is Test {
    SwapVMRuleEngine public engine;

    bytes public constant BYTECODE_BASE = hex"01";
    bytes public constant BYTECODE_CRUISE = hex"0102";
    bytes public constant BYTECODE_FULL = hex"010203";
    bytes public constant BYTECODE_ALL_OPCODES = hex"01020304";

    function setUp() public {
        engine = new SwapVMRuleEngine();
    }

    function test_ValidateBytecode_ValidOpcodes() public view {
        assertTrue(engine.validateBytecode(BYTECODE_BASE));
        assertTrue(engine.validateBytecode(BYTECODE_CRUISE));
        assertTrue(engine.validateBytecode(BYTECODE_FULL));
        assertTrue(engine.validateBytecode(BYTECODE_ALL_OPCODES));
    }

    function test_ValidateBytecode_InvalidOpcodes() public view {
        assertFalse(engine.validateBytecode(hex"")); // Empty
        assertFalse(engine.validateBytecode(hex"05")); // Unknown opcode
        assertFalse(engine.validateBytecode(hex"0105")); // Contains unknown opcode
        assertFalse(engine.validateBytecode(hex"0203")); // Missing 0x01 base allocation
    }

    function test_EvaluateFuelBurnCurve_BaseAllocation() public view {
        uint256 altitudeMeters = 5000;
        int256 verticalRateMps = 0;
        uint256 airborneSeconds = 3600; // 1 hour
        uint256 baseHourlyBurnKg = 2400; // Narrow-body benchmark

        (uint256 finalFuelBurnKg, uint256 co2Kg, uint256 offsetCostUSDC) = engine.evaluateFuelBurnCurve(
            BYTECODE_FULL,
            altitudeMeters,
            verticalRateMps,
            airborneSeconds,
            baseHourlyBurnKg
        );

        // 1 hour at 2400 kg/h = 2400 kg fuel
        assertEq(finalFuelBurnKg, 2400);
        // 2400 * 3.16 = 7584 kg CO2
        assertEq(co2Kg, 7584);
        // 7584 kg CO2 at $25/tonne = 7.584 tonnes * $25 = $189.60 = 189,600,000 micro-USDC
        assertEq(offsetCostUSDC, 189_600_000);
    }

    function test_EvaluateFuelBurnCurve_CruiseAltitudeDiscount() public view {
        uint256 altitudeMeters = 12000; // Max cruise altitude (>9000m)
        int256 verticalRateMps = 0;
        uint256 airborneSeconds = 3600;
        uint256 baseHourlyBurnKg = 2400;

        (uint256 finalFuelBurnKg, uint256 co2Kg, uint256 offsetCostUSDC) = engine.evaluateFuelBurnCurve(
            BYTECODE_FULL,
            altitudeMeters,
            verticalRateMps,
            airborneSeconds,
            baseHourlyBurnKg
        );

        // 2400 * 80% = 1920 kg fuel
        assertEq(finalFuelBurnKg, 1920);
        // 1920 * 3.16 = 6067.2 -> 6067 kg CO2
        assertEq(co2Kg, 6067);
        // 6067 * 25,000,000 / 1000 = 151,675,000 micro-USDC ($151.675)
        assertEq(offsetCostUSDC, 151_675_000);
    }

    function test_EvaluateFuelBurnCurve_ClimbThrustScale() public view {
        uint256 altitudeMeters = 3000; // Below 9000m
        int256 verticalRateMps = 10; // High climb rate (>2 m/s)
        uint256 airborneSeconds = 3600;
        uint256 baseHourlyBurnKg = 2400;

        (uint256 finalFuelBurnKg, uint256 co2Kg, uint256 offsetCostUSDC) = engine.evaluateFuelBurnCurve(
            BYTECODE_FULL,
            altitudeMeters,
            verticalRateMps,
            airborneSeconds,
            baseHourlyBurnKg
        );

        // 2400 * 135% = 3240 kg fuel
        assertEq(finalFuelBurnKg, 3240);
        // 3240 * 3.16 = 10238.4 -> 10238 kg CO2
        assertEq(co2Kg, 10238);
        // 10238 * 25,000,000 / 1000 = 255,950,000 micro-USDC ($255.95)
        assertEq(offsetCostUSDC, 255_950_000);
    }

    function test_EvaluateFuelBurnCurve_DescentDecay() public view {
        uint256 altitudeMeters = 4000;
        int256 verticalRateMps = -10; // Steep descent
        uint256 airborneSeconds = 3600;
        uint256 baseHourlyBurnKg = 2400;

        (uint256 finalFuelBurnKg, uint256 co2Kg, uint256 offsetCostUSDC) = engine.evaluateFuelBurnCurve(
            BYTECODE_ALL_OPCODES,
            altitudeMeters,
            verticalRateMps,
            airborneSeconds,
            baseHourlyBurnKg
        );

        // 2400 * 70% descent decay = 1680 kg fuel
        assertEq(finalFuelBurnKg, 1680);
        // 1680 * 3.16 = 5308.8 -> 5308 kg CO2
        assertEq(co2Kg, 5308);
        assertEq(offsetCostUSDC, 132_700_000);
    }

    function test_EvaluateFuelBurnCurve_RevertsOnInvalidBytecode() public {
        vm.expectRevert("Invalid SwapVM bytecode");
        engine.evaluateFuelBurnCurve(hex"05", 5000, 0, 3600, 2400);

        vm.expectRevert("Invalid SwapVM bytecode");
        engine.evaluateFuelBurnCurve(hex"", 5000, 0, 3600, 2400);
    }
}
