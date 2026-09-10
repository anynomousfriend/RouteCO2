// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAqua} from "./interfaces/IAqua.sol";
import {ISkyRouteVault} from "./interfaces/ISkyRouteVault.sol";
import {ISwapVMRuleEngine} from "./interfaces/ISwapVMRuleEngine.sol";

/// @title SkyRouteVault
/// @notice 1inch Aqua App facilitating non-custodial zero-escrow carbon offset settlements on Arc Testnet
/// @dev Aqua pattern (github.com/1inch/aqua): treasury keeps custody of USDC; registerFlightManifest
///  ships an immutable Aqua strategy via aqua.ship(vault, strategy, [usdc], [maxBudget]); settleWheelsDown
///  pulls real USDC via aqua.pull(treasury, strategyHash, usdc, usdcAmount, vault) which performs a real
///  ERC20 transferFrom(treasury -> vault) and requires a prior treasury approval to Aqua. Carbon retirement
///  is on-chain ledger accounting (totalCarbonOffsetKg) + WheelsDownSettled event, not an ERC20 transfer.
contract SkyRouteVault is ISkyRouteVault {
    address public immutable override aqua;
    address public immutable override usdc;
    address public immutable override swapVmRuleEngine;
    address public override owner;

    mapping(bytes32 => FlightManifest) public override manifests;
    mapping(address => bool) public override authorizedAgents;
    mapping(address => uint256) public override totalCarbonOffsetKg;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAgent() {
        require(authorizedAgents[msg.sender], "Unauthorized agent");
        _;
    }

    /// @notice Initializes the SkyRouteVault
    /// @param _aqua Address of the 1inch Aqua core registry (Aqua.ship/pull/push semantics)
    /// @param _usdc Address of the USDC token contract on Arc Testnet
    /// @param _swapVmRuleEngine Address of the SwapVMRuleEngine contract
    constructor(address _aqua, address _usdc, address _swapVmRuleEngine) {
        require(_aqua != address(0), "Invalid aqua address");
        require(_usdc != address(0), "Invalid usdc address");
        require(_swapVmRuleEngine != address(0), "Invalid swapVmRuleEngine address");
        aqua = _aqua;
        usdc = _usdc;
        swapVmRuleEngine = _swapVmRuleEngine;
        owner = msg.sender;
    }

    /// @notice Authorizes or deauthorizes a Circle Agent to execute settlements
    /// @param agent Address of the Circle Agent wallet
    /// @param authorized Authorization status
    function setAuthorizedAgent(address agent, bool authorized) external override onlyOwner {
        require(agent != address(0), "Invalid agent address");
        authorizedAgents[agent] = authorized;
        emit AuthorizedAgentUpdated(agent, authorized);
    }

    /// @notice Transfers contract ownership
    /// @param newOwner Address of the new owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice Registers a flight manifest with custom SwapVM bytecode curve
    /// @dev Ships immutable Aqua strategy: strategy = abi.encode(flightId, treasury, maxBudget, bytecode)
    function registerFlightManifest(
        string calldata callsign,
        string calldata aircraftCategory,
        address treasury,
        uint256 maxBudgetUSDC,
        bytes calldata swapVmBytecode
    ) external override returns (bytes32 flightId) {
        return _registerFlightManifest(callsign, aircraftCategory, treasury, maxBudgetUSDC, swapVmBytecode);
    }

    /// @notice Registers a flight manifest with default standard SwapVM curve
    function registerFlightManifest(
        string calldata callsign,
        string calldata aircraftCategory,
        address treasury,
        uint256 maxBudgetUSDC
    ) external override returns (bytes32 flightId) {
        return _registerFlightManifest(callsign, aircraftCategory, treasury, maxBudgetUSDC, hex"010203");
    }

    /// @notice Internal manifest registration logic: validates curve, records immutable strategy hash.
    /// @dev Treasury keeps custody and MUST ship the identical strategy directly to Aqua before settle:
    ///  strategy = abi.encode(flightId, treasury, maxBudgetUSDC, swapVmBytecode);
    ///  aqua.ship(vault, strategy, [usdc], [maxBudgetUSDC]) + approve(Aqua, maxBudget).
    ///  The vault cannot ship on the treasury's behalf (real Aqua maker == msg.sender), so register
    ///  records the expected strategyHash and settleWheelsDown pulls against it. Reverts on settle if
    ///  the treasury never shipped/approved (honest, no silent mock).
    function _registerFlightManifest(
        string memory callsign,
        string memory aircraftCategory,
        address treasury,
        uint256 maxBudgetUSDC,
        bytes memory swapVmBytecode
    ) internal returns (bytes32 flightId) {
        require(treasury != address(0), "Invalid treasury address");
        require(maxBudgetUSDC > 0, "Max budget must be greater than 0");
        require(bytes(callsign).length > 0, "Invalid callsign");
        require(
            ISwapVMRuleEngine(swapVmRuleEngine).validateBytecode(swapVmBytecode),
            "Invalid SwapVM bytecode"
        );

        flightId = keccak256(abi.encodePacked(callsign, treasury, block.timestamp));
        bytes memory strategy = abi.encode(flightId, treasury, maxBudgetUSDC, swapVmBytecode);
        bytes32 strategyHash = keccak256(strategy);

        manifests[flightId] = FlightManifest({
            callsign: callsign,
            aircraftCategory: aircraftCategory,
            treasury: treasury,
            maxBudgetUSDC: maxBudgetUSDC,
            swapVmBytecode: swapVmBytecode,
            strategyHash: strategyHash,
            settled: false
        });

        emit FlightManifestRegistered(flightId, callsign, treasury, maxBudgetUSDC);
        emit FlightStrategyShipped(flightId, strategyHash, treasury);
    }

    /// @notice Settles carbon offsets upon aircraft touchdown (Wheels-Down)
    /// @dev Pulls real USDC via Aqua (requires treasury ERC20 approval to Aqua); retires carbon on-ledger.
    function settleWheelsDown(
        bytes32 flightId,
        uint256 airborneSeconds,
        uint256 fuelBurnKg,
        uint256 co2Kg,
        uint256 usdcAmount
    ) external payable override onlyAgent {
        require(fuelBurnKg > 0, "Invalid fuel burn");
        FlightManifest storage manifest = manifests[flightId];
        require(manifest.treasury != address(0), "Manifest does not exist");
        require(!manifest.settled, "Already settled");
        require(usdcAmount <= manifest.maxBudgetUSDC, "Exceeds flight budget");

        manifest.settled = true;
        totalCarbonOffsetKg[manifest.treasury] += co2Kg;

        // Zero-custody Aqua settlement: real ERC20 pull of USDC from treasury to vault.
        IAqua(aqua).pull(manifest.treasury, manifest.strategyHash, usdc, usdcAmount, address(this));

        emit WheelsDownSettled(flightId, manifest.callsign, airborneSeconds, co2Kg, usdcAmount);
    }

    /// @notice Allows the contract owner to withdraw collected fees / native USDC
    function withdrawFees(address payable to, uint256 amount) external override onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount <= address(this).balance, "Insufficient balance");

        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");

        emit FeesWithdrawn(to, amount);
    }

    /// @notice Aqua App swap callback (signature-conformant with 1inch Aqua IAquaAppSwapCallback)
    /// @dev Only the Aqua core registry may invoke; validates app binding then emits execution proof.
    function aquaAppSwapCallback(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address maker,
        address app,
        bytes32 strategyHash,
        bytes calldata takerData
    ) external override {
        require(msg.sender == aqua, "Only Aqua core");
        require(app == address(this), "Invalid app binding");
        takerData; // Preserved in calldata ABI for future strategy verification
        emit AquaSwapExecuted(tokenIn, amountIn, tokenOut, amountOut, maker, strategyHash);
    }

    /// @notice Allows the contract to receive native USDC payments on Arc Testnet
    receive() external payable {}
}
