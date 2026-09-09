// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SkyRouteVault} from "../src/SkyRouteVault.sol";
import {AquaCore} from "../src/AquaCore.sol";
import {SwapVMRuleEngine} from "../src/SwapVMRuleEngine.sol";
import {IAqua} from "../src/interfaces/IAqua.sol";
import {ISkyRouteVault} from "../src/interfaces/ISkyRouteVault.sol";

contract SkyRouteVaultTest is Test {
    SkyRouteVault public vault;
    AquaCore public aqua;
    SwapVMRuleEngine public ruleEngine;

    address public owner = address(0xABCD);
    address public agent = address(0x1111);
    address public unauthorizedCaller = address(0x9999);
    address public treasury = address(0x2222);
    address public usdcToken = 0x036CbD53842c5426634e7929541eC2318f3dCF7e; // Base Sepolia / Arc USDC format

    string public constant CALLSIGN = "UAL100";
    string public constant AIRCRAFT_CAT = "B77W";
    uint256 public constant MAX_BUDGET = 500e6; // 500 USDC
    bytes public constant VALID_BYTECODE = hex"01020304";

    event FlightManifestRegistered(
        bytes32 indexed flightId,
        string callsign,
        address treasury,
        uint256 maxBudget
    );

    event WheelsDownSettled(
        bytes32 indexed flightId,
        string callsign,
        uint256 airborneSeconds,
        uint256 co2Kg,
        uint256 usdcAmount
    );

    event AuthorizedAgentUpdated(address indexed agent, bool authorized);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event AquaSwapExecuted(address indexed tokenIn, uint256 amountIn, address indexed tokenOut, uint256 amountOut);

    function setUp() public {
        vm.startPrank(owner);
        aqua = new AquaCore();
        ruleEngine = new SwapVMRuleEngine();
        vault = new SkyRouteVault(address(aqua), usdcToken, address(ruleEngine));
        vault.setAuthorizedAgent(agent, true);
        vm.stopPrank();
    }

    function test_InitialDeploymentState() public view {
        assertEq(vault.owner(), owner);
        assertEq(vault.aqua(), address(aqua));
        assertEq(vault.usdc(), usdcToken);
        assertEq(vault.swapVmRuleEngine(), address(ruleEngine));
        assertTrue(vault.authorizedAgents(agent));
        assertFalse(vault.authorizedAgents(unauthorizedCaller));
    }

    function test_ConstructorRevertsOnZeroAddress() public {
        vm.expectRevert("Invalid aqua address");
        new SkyRouteVault(address(0), usdcToken, address(ruleEngine));

        vm.expectRevert("Invalid usdc address");
        new SkyRouteVault(address(aqua), address(0), address(ruleEngine));

        vm.expectRevert("Invalid swapVmRuleEngine address");
        new SkyRouteVault(address(aqua), usdcToken, address(0));
    }

    function test_RegisterFlightManifest_DefaultCurve() public {
        vm.warp(1787940000);

        bytes32 expectedFlightId = keccak256(abi.encodePacked(CALLSIGN, treasury, block.timestamp));

        vm.expectEmit(true, false, false, true);
        emit FlightManifestRegistered(expectedFlightId, CALLSIGN, treasury, MAX_BUDGET);

        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);
        assertEq(flightId, expectedFlightId);

        (
            string memory callsign,
            string memory aircraftCategory,
            address manifestTreasury,
            uint256 maxBudgetUSDC,
            bytes memory swapVmBytecode,
            bool settled
        ) = vault.manifests(flightId);

        assertEq(callsign, CALLSIGN);
        assertEq(aircraftCategory, AIRCRAFT_CAT);
        assertEq(manifestTreasury, treasury);
        assertEq(maxBudgetUSDC, MAX_BUDGET);
        assertEq(swapVmBytecode, hex"010203");
        assertFalse(settled);
    }

    function test_RegisterFlightManifest_CustomSwapVMBytecode() public {
        vm.warp(1787940000);

        bytes32 expectedFlightId = keccak256(abi.encodePacked(CALLSIGN, treasury, block.timestamp));

        vm.expectEmit(true, false, false, true);
        emit FlightManifestRegistered(expectedFlightId, CALLSIGN, treasury, MAX_BUDGET);

        bytes32 flightId = vault.registerFlightManifest(
            CALLSIGN,
            AIRCRAFT_CAT,
            treasury,
            MAX_BUDGET,
            VALID_BYTECODE
        );
        assertEq(flightId, expectedFlightId);

        (,,,, bytes memory swapVmBytecode, bool settled) = vault.manifests(flightId);
        assertEq(swapVmBytecode, VALID_BYTECODE);
        assertFalse(settled);
    }

    function test_RegisterFlightManifest_RevertsOnInvalidBytecode() public {
        vm.expectRevert("Invalid SwapVM bytecode");
        vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET, hex"05");

        vm.expectRevert("Invalid SwapVM bytecode");
        vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET, hex"");
    }

    function test_RegisterFlightManifest_RevertsOnInvalidInputs() public {
        vm.expectRevert("Invalid treasury address");
        vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, address(0), MAX_BUDGET);

        vm.expectRevert("Max budget must be greater than 0");
        vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, 0);

        vm.expectRevert("Invalid callsign");
        vault.registerFlightManifest("", AIRCRAFT_CAT, treasury, MAX_BUDGET);
    }

    function test_UnauthorizedCallerCannotSettle() public {
        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);

        vm.prank(unauthorizedCaller);
        vm.expectRevert("Unauthorized agent");
        vault.settleWheelsDown(flightId, 7200, 1500, 4740, 120e6);
    }

    function test_OverBudgetSettlementReverts() public {
        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);

        uint256 overBudgetAmount = MAX_BUDGET + 1;

        vm.prank(agent);
        vm.expectRevert("Exceeds flight budget");
        vault.settleWheelsDown(flightId, 7200, 1500, 4740, overBudgetAmount);
    }

    function test_SettleWheelsDown_RevertsOnZeroFuelBurn() public {
        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);

        vm.prank(agent);
        vm.expectRevert("Invalid fuel burn");
        vault.settleWheelsDown(flightId, 7200, 0, 4740, 100e6);
    }

    function test_AuthorizedAgentCanSettle() public {
        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);

        uint256 airborneSeconds = 7200; // 2 hours
        uint256 fuelBurnKg = 1500;
        uint256 co2Kg = 4740; // 1500 * 3.16
        uint256 usdcAmount = 142e6; // $142 USDC

        vm.expectEmit(true, false, false, true);
        emit WheelsDownSettled(flightId, CALLSIGN, airborneSeconds, co2Kg, usdcAmount);

        vm.deal(agent, 1000 ether);
        vm.prank(agent);
        vault.settleWheelsDown{value: usdcAmount}(flightId, airborneSeconds, fuelBurnKg, co2Kg, usdcAmount);

        // Verify manifest marked settled
        (,,,,, bool settled) = vault.manifests(flightId);
        assertTrue(settled);

        // Verify carbon offset credits credited to treasury
        assertEq(vault.totalCarbonOffsetKg(treasury), co2Kg);
        assertEq(address(vault).balance, usdcAmount);
    }

    function test_DuplicateSettlementReverts() public {
        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);

        vm.prank(agent);
        vault.settleWheelsDown(flightId, 7200, 1500, 4740, 100e6);

        // Second attempt must revert
        vm.prank(agent);
        vm.expectRevert("Already settled");
        vault.settleWheelsDown(flightId, 7200, 1500, 4740, 100e6);
    }

    function test_NonexistentFlightReverts() public {
        bytes32 fakeFlightId = keccak256("NONEXISTENT_FLIGHT");

        vm.prank(agent);
        vm.expectRevert("Manifest does not exist");
        vault.settleWheelsDown(fakeFlightId, 7200, 1500, 4740, 100e6);
    }

    function test_OwnerCanWithdrawFees() public {
        // Fund vault with 100 USDC via settlement
        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);
        uint256 usdcAmount = 100e6;

        vm.deal(agent, 100 ether);
        vm.prank(agent);
        vault.settleWheelsDown{value: usdcAmount}(flightId, 7200, 1500, 4740, usdcAmount);

        assertEq(address(vault).balance, usdcAmount);

        address payable recipient = payable(address(0x7777));
        uint256 beforeBalance = recipient.balance;

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit FeesWithdrawn(recipient, usdcAmount);
        vault.withdrawFees(recipient, usdcAmount);

        assertEq(recipient.balance, beforeBalance + usdcAmount);
        assertEq(address(vault).balance, 0);
    }

    function test_WithdrawFees_RevertsOnUnauthorized() public {
        vm.deal(address(vault), 100e6);

        vm.prank(unauthorizedCaller);
        vm.expectRevert("Only owner");
        vault.withdrawFees(payable(unauthorizedCaller), 100e6);
    }

    function test_WithdrawFees_RevertsOnInsufficientBalance() public {
        vm.deal(address(vault), 50e6);

        vm.prank(owner);
        vm.expectRevert("Insufficient balance");
        vault.withdrawFees(payable(owner), 100e6);
    }

    function test_WithdrawFees_RevertsOnZeroRecipient() public {
        vm.deal(address(vault), 100e6);

        vm.prank(owner);
        vm.expectRevert("Invalid recipient");
        vault.withdrawFees(payable(address(0)), 100e6);
    }

    function test_AquaAppSwapCallback_ExecutedByAquaCore() public {
        address tokenIn = usdcToken;
        address tokenOut = address(0x4444);
        uint256 amountIn = 100e6;
        uint256 amountOut = 316e6;

        vm.prank(address(aqua));
        vm.expectEmit(true, false, true, true);
        emit AquaSwapExecuted(tokenIn, amountIn, tokenOut, amountOut);
        vault.aquaAppSwapCallback(tokenIn, amountIn, tokenOut, amountOut, "");
    }

    function test_AquaAppSwapCallback_RevertsOnNonAquaCaller() public {
        vm.prank(unauthorizedCaller);
        vm.expectRevert("Only Aqua core");
        vault.aquaAppSwapCallback(usdcToken, 100e6, address(0x4444), 316e6, "");
    }

    function test_AquaCore_ShipAndVirtualBalances() public {
        address tokenOut = address(0x5555);
        uint256 virtualTvu = 500e6;

        vm.expectEmit(true, true, true, true);
        emit IAqua.Shipped(treasury, usdcToken, tokenOut, virtualTvu);
        aqua.ship(treasury, usdcToken, tokenOut, virtualTvu);

        assertEq(aqua.virtualBalances(treasury, usdcToken), virtualTvu);

        // Test pull and push
        vm.expectEmit(true, false, false, true);
        emit IAqua.Pulled(treasury, 100e6);
        aqua.pull(treasury, 100e6);

        vm.expectEmit(true, false, false, true);
        emit IAqua.Pushed(treasury, 316e6);
        aqua.push(treasury, 316e6);
    }

    function test_AquaCore_Ship_RevertsOnZeroInputs() public {
        vm.expectRevert("Invalid maker address");
        aqua.ship(address(0), usdcToken, address(0x5555), 100);

        vm.expectRevert("Invalid tokenIn address");
        aqua.ship(treasury, address(0), address(0x5555), 100);

        vm.expectRevert("Invalid tokenOut address");
        aqua.ship(treasury, usdcToken, address(0), 100);

        vm.expectRevert("Virtual TVU must be greater than 0");
        aqua.ship(treasury, usdcToken, address(0x5555), 0);
    }

    function test_OwnerCanAuthorizeAndDeauthorizeAgent() public {
        address newAgent = address(0x5555);

        // Non-owner cannot update agent
        vm.prank(unauthorizedCaller);
        vm.expectRevert("Only owner");
        vault.setAuthorizedAgent(newAgent, true);

        // Owner can authorize
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit AuthorizedAgentUpdated(newAgent, true);
        vault.setAuthorizedAgent(newAgent, true);
        assertTrue(vault.authorizedAgents(newAgent));

        // Owner cannot pass zero address
        vm.prank(owner);
        vm.expectRevert("Invalid agent address");
        vault.setAuthorizedAgent(address(0), true);

        // Owner can deauthorize
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit AuthorizedAgentUpdated(newAgent, false);
        vault.setAuthorizedAgent(newAgent, false);
        assertFalse(vault.authorizedAgents(newAgent));

        // Deauthorized agent cannot settle
        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);
        vm.prank(newAgent);
        vm.expectRevert("Unauthorized agent");
        vault.settleWheelsDown(flightId, 7200, 1500, 4740, 100e6);
    }

    function test_TransferOwnership() public {
        address newOwner = address(0x8888);

        // Non-owner cannot transfer
        vm.prank(unauthorizedCaller);
        vm.expectRevert("Only owner");
        vault.transferOwnership(newOwner);

        // Owner cannot transfer to zero address
        vm.prank(owner);
        vm.expectRevert("Invalid new owner");
        vault.transferOwnership(address(0));

        // Owner can transfer
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit OwnershipTransferred(owner, newOwner);
        vault.transferOwnership(newOwner);

        assertEq(vault.owner(), newOwner);

        // Old owner can no longer set authorized agent
        vm.prank(owner);
        vm.expectRevert("Only owner");
        vault.setAuthorizedAgent(agent, false);
    }
}
