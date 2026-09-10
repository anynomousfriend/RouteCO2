// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SkyRouteVault} from "../src/SkyRouteVault.sol";
import {AquaCore} from "../src/AquaCore.sol";
import {SwapVMRuleEngine} from "../src/SwapVMRuleEngine.sol";
import {IAqua} from "../src/interfaces/IAqua.sol";
import {ISkyRouteVault} from "../src/interfaces/ISkyRouteVault.sol";

/// @notice Minimal 6-decimal test USDC (test-only helper, never deployed to testnet as production token).
contract TestUSDC {
    string public name = "Test USDC";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient");
        require(allowance[from][msg.sender] >= amount, "Allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract SkyRouteVaultTest is Test {
    SkyRouteVault public vault;
    AquaCore public aqua;
    SwapVMRuleEngine public ruleEngine;
    TestUSDC public usdcToken;

    address public owner = address(0xABCD);
    address public agent = address(0x1111);
    address public unauthorizedCaller = address(0x9999);
    address public treasury = address(0x2222);

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
    event AquaSwapExecuted(
        address indexed tokenIn,
        uint256 amountIn,
        address indexed tokenOut,
        uint256 amountOut,
        address maker,
        bytes32 strategyHash
    );

    function setUp() public {
        vm.startPrank(owner);
        aqua = new AquaCore();
        ruleEngine = new SwapVMRuleEngine();
        usdcToken = new TestUSDC();
        vault = new SkyRouteVault(address(aqua), address(usdcToken), address(ruleEngine));
        vault.setAuthorizedAgent(agent, true);
        vm.stopPrank();

        // Fund treasury with test USDC and approve Aqua for real pull() transfers
        usdcToken.mint(treasury, 10_000e6);
        vm.prank(treasury);
        usdcToken.approve(address(aqua), type(uint256).max);
    }

    function test_InitialDeploymentState() public view {
        assertEq(vault.owner(), owner);
        assertEq(vault.aqua(), address(aqua));
        assertEq(vault.usdc(), address(usdcToken));
        assertEq(vault.swapVmRuleEngine(), address(ruleEngine));
        assertTrue(vault.authorizedAgents(agent));
        assertFalse(vault.authorizedAgents(unauthorizedCaller));
    }

    function test_ConstructorRevertsOnZeroAddress() public {
        vm.expectRevert("Invalid aqua address");
        new SkyRouteVault(address(0), address(usdcToken), address(ruleEngine));

        vm.expectRevert("Invalid usdc address");
        new SkyRouteVault(address(aqua), address(0), address(ruleEngine));

        vm.expectRevert("Invalid swapVmRuleEngine address");
        new SkyRouteVault(address(aqua), address(usdcToken), address(0));
    }

    function test_RegisterFlightManifest_DefaultCurve() public {
        vm.warp(1787940000);

        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);

        (
            string memory callsign,
            string memory aircraftCategory,
            address manifestTreasury,
            uint256 maxBudgetUSDC,
            bytes memory swapVmBytecode,
            bytes32 strategyHash,
            bool settled
        ) = vault.manifests(flightId);

        assertEq(callsign, CALLSIGN);
        assertEq(aircraftCategory, AIRCRAFT_CAT);
        assertEq(manifestTreasury, treasury);
        assertEq(maxBudgetUSDC, MAX_BUDGET);
        assertEq(swapVmBytecode, hex"010203");
        assertTrue(strategyHash != bytes32(0));
        assertFalse(settled);

        // Treasury ships the identical strategy directly to Aqua (real maker == treasury)
        bytes memory strategy = abi.encode(flightId, treasury, MAX_BUDGET, swapVmBytecode);
        assertEq(keccak256(strategy), strategyHash);
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdcToken);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = MAX_BUDGET;
        vm.prank(treasury);
        bytes32 shippedHash = aqua.ship(address(vault), strategy, tokens, amounts);
        assertEq(shippedHash, strategyHash);

        // Strategy ships real virtual USDC liquidity in Aqua
        (uint256 bal,) = aqua.rawBalances(treasury, address(vault), strategyHash, address(usdcToken));
        assertEq(bal, MAX_BUDGET);
    }

    function test_RegisterFlightManifest_CustomSwapVMBytecode() public {
        vm.warp(1787940000);

        bytes32 flightId = vault.registerFlightManifest(
            CALLSIGN,
            AIRCRAFT_CAT,
            treasury,
            MAX_BUDGET,
            VALID_BYTECODE
        );

        (,,,, bytes memory swapVmBytecode, bytes32 strategyHash, bool settled) = vault.manifests(flightId);
        assertEq(swapVmBytecode, VALID_BYTECODE);
        assertTrue(strategyHash != bytes32(0));
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

    function test_AuthorizedAgentCanSettle_RealAquaPull() public {
        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);
        _shipTreasuryStrategy(flightId, treasury, MAX_BUDGET, hex"010203");

        uint256 airborneSeconds = 7200; // 2 hours
        uint256 fuelBurnKg = 1500;
        uint256 co2Kg = 4740; // 1500 * 3.16
        uint256 usdcAmount = 142e6; // $142 USDC

        uint256 treasuryBefore = usdcToken.balanceOf(treasury);
        uint256 vaultBefore = usdcToken.balanceOf(address(vault));

        vm.expectEmit(true, false, false, true);
        emit WheelsDownSettled(flightId, CALLSIGN, airborneSeconds, co2Kg, usdcAmount);

        vm.prank(agent);
        vault.settleWheelsDown(flightId, airborneSeconds, fuelBurnKg, co2Kg, usdcAmount);

        // Verify manifest marked settled
        (,,,,, , bool settled) = vault.manifests(flightId);
        assertTrue(settled);

        // Verify carbon offset credits credited to treasury (on-ledger retirement)
        assertEq(vault.totalCarbonOffsetKg(treasury), co2Kg);
        // Verify REAL USDC moved treasury -> vault via Aqua.pull
        assertEq(usdcToken.balanceOf(treasury), treasuryBefore - usdcAmount);
        assertEq(usdcToken.balanceOf(address(vault)), vaultBefore + usdcAmount);
    }

    function test_DuplicateSettlementReverts() public {
        bytes32 flightId = vault.registerFlightManifest(CALLSIGN, AIRCRAFT_CAT, treasury, MAX_BUDGET);
        _shipTreasuryStrategy(flightId, treasury, MAX_BUDGET, hex"010203");

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
        address payable recipient = payable(address(0x7777));
        vm.deal(address(vault), 100e6);
        uint256 beforeBalance = recipient.balance;

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit FeesWithdrawn(recipient, 100e6);
        vault.withdrawFees(recipient, 100e6);

        assertEq(recipient.balance, beforeBalance + 100e6);
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
        bytes32 strategyHash = keccak256("TEST_STRATEGY");
        address tokenOut = address(0x4444);

        vm.prank(address(aqua));
        vm.expectEmit(true, false, true, true);
        emit AquaSwapExecuted(address(usdcToken), 100e6, tokenOut, 316e6, treasury, strategyHash);
        vault.aquaAppSwapCallback(address(usdcToken), tokenOut, 100e6, 316e6, treasury, address(vault), strategyHash, "");
    }

    function test_AquaAppSwapCallback_RevertsOnNonAquaCaller() public {
        vm.prank(unauthorizedCaller);
        vm.expectRevert("Only Aqua core");
        vault.aquaAppSwapCallback(
            address(usdcToken), address(0x4444), 100e6, 316e6, treasury, address(vault), keccak256("X"), ""
        );
    }

    function test_AquaCore_ShipPullAndBalances() public {
        bytes memory strategy = abi.encode("FLIGHT-1", treasury, MAX_BUDGET);
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdcToken);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = MAX_BUDGET;

        vm.prank(treasury);
        bytes32 strategyHash = aqua.ship(address(vault), strategy, tokens, amounts);
        assertTrue(strategyHash != bytes32(0));

        (uint256 bal,) = aqua.rawBalances(treasury, address(vault), strategyHash, address(usdcToken));
        assertEq(bal, MAX_BUDGET);

        // Real pull: treasury -> vault (treasury approved Aqua in setUp)
        uint256 pullAmount = 100e6;
        uint256 tBefore = usdcToken.balanceOf(treasury);
        vm.prank(address(vault));
        aqua.pull(treasury, strategyHash, address(usdcToken), pullAmount, address(vault));
        assertEq(usdcToken.balanceOf(treasury), tBefore - pullAmount);

        (uint256 balAfter,) = aqua.rawBalances(treasury, address(vault), strategyHash, address(usdcToken));
        assertEq(balAfter, MAX_BUDGET - pullAmount);
    }

    function test_AquaCore_Ship_RevertsOnZeroInputs() public {
        bytes memory strategy = abi.encode("X");
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdcToken);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100;

        address[] memory empty = new address[](0);
        uint256[] memory emptyAmt = new uint256[](0);

        vm.expectRevert("Invalid app address");
        vm.prank(treasury);
        aqua.ship(address(0), strategy, tokens, amounts);

        vm.expectRevert("Invalid tokens count");
        vm.prank(treasury);
        aqua.ship(address(vault), strategy, empty, emptyAmt);
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

    /// @notice Ships the identical flight strategy directly from the treasury (real Aqua maker == treasury)
    function _shipTreasuryStrategy(bytes32 flightId, address treasuryAddr, uint256 maxBudget, bytes memory bytecode)
        internal
    {
        bytes memory strategy = abi.encode(flightId, treasuryAddr, maxBudget, bytecode);
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdcToken);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = maxBudget;
        vm.prank(treasuryAddr);
        aqua.ship(address(vault), strategy, tokens, amounts);
    }
}
