// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SkyRouteVault} from "../src/SkyRouteVault.sol";
import {AquaCore} from "../src/AquaCore.sol";
import {IAqua} from "../src/interfaces/IAqua.sol";
import {ISkyRouteVault} from "../src/interfaces/ISkyRouteVault.sol";

contract SkyRouteVaultTest is Test {
    SkyRouteVault public vault;
    AquaCore public aqua;

    address public owner = address(0xABCD);
    address public agent = address(0x1111);
    address public unauthorizedCaller = address(0x9999);
    address public treasury = address(0x2222);
    address public usdcToken = 0x036CbD53842c5426634e7929541eC2318f3dCF7e; // Base Sepolia / Arc USDC format

    string public constant CALLSIGN = "UAL100";
    string public constant AIRCRAFT_CAT = "B77W";
    uint256 public constant MAX_BUDGET = 500e6; // 500 USDC

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

    function setUp() public {
        vm.startPrank(owner);
        aqua = new AquaCore();
        vault = new SkyRouteVault(address(aqua), usdcToken);
        vault.setAuthorizedAgent(agent, true);
        vm.stopPrank();
    }

    function test_InitialDeploymentState() public view {
        assertEq(vault.owner(), owner);
        assertEq(vault.aqua(), address(aqua));
        assertEq(vault.usdc(), usdcToken);
        assertTrue(vault.authorizedAgents(agent));
        assertFalse(vault.authorizedAgents(unauthorizedCaller));
    }

    function test_ConstructorRevertsOnZeroAddress() public {
        vm.expectRevert("Invalid aqua address");
        new SkyRouteVault(address(0), usdcToken);

        vm.expectRevert("Invalid usdc address");
        new SkyRouteVault(address(aqua), address(0));
    }

    function test_RegisterFlightManifest() public {
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
            bool settled
        ) = vault.manifests(flightId);

        assertEq(callsign, CALLSIGN);
        assertEq(aircraftCategory, AIRCRAFT_CAT);
        assertEq(manifestTreasury, treasury);
        assertEq(maxBudgetUSDC, MAX_BUDGET);
        assertFalse(settled);
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

    function test_AuthorizedAgentCanSettle() public {
        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);

        uint256 airborneSeconds = 7200; // 2 hours
        uint256 fuelBurnKg = 1500;
        uint256 co2Kg = 4740; // 1500 * 3.16
        uint256 usdcAmount = 142e6; // $142 USDC

        vm.expectEmit(true, false, false, true);
        emit WheelsDownSettled(flightId, CALLSIGN, airborneSeconds, co2Kg, usdcAmount);

        vm.prank(agent);
        vault.settleWheelsDown(flightId, airborneSeconds, fuelBurnKg, co2Kg, usdcAmount);

        // Verify manifest marked settled
        (,,,, bool settled) = vault.manifests(flightId);
        assertTrue(settled);
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
