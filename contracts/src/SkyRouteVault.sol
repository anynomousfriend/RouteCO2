// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAqua} from "./interfaces/IAqua.sol";
import {ISkyRouteVault} from "./interfaces/ISkyRouteVault.sol";

/// @title SkyRouteVault
/// @notice 1inch Aqua App facilitating non-custodial zero-escrow carbon offset settlements on Arc Testnet
contract SkyRouteVault is ISkyRouteVault {
    address public immutable override aqua;
    address public immutable override usdc;
    address public override owner;

    mapping(bytes32 => FlightManifest) public override manifests;
    mapping(address => bool) public override authorizedAgents;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAgent() {
        require(authorizedAgents[msg.sender], "Unauthorized agent");
        _;
    }

    /// @notice Initializes the SkyRouteVault
    /// @param _aqua Address of the 1inch Aqua core registry
    /// @param _usdc Address of the USDC token contract on Arc Testnet
    constructor(address _aqua, address _usdc) {
        require(_aqua != address(0), "Invalid aqua address");
        require(_usdc != address(0), "Invalid usdc address");
        aqua = _aqua;
        usdc = _usdc;
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

    /// @notice Registers a flight manifest with an approved budget cap
    /// @param callsign Flight callsign (e.g. "UAL100")
    /// @param aircraftCategory Aircraft ICAO type/category (e.g. "B77W")
    /// @param treasury Airline corporate treasury address holding USDC
    /// @param maxBudgetUSDC Maximum USDC allowance for carbon offset settlement
    /// @return flightId Unique manifest identifier
    function registerFlightManifest(
        string calldata callsign,
        string calldata aircraftCategory,
        address treasury,
        uint256 maxBudgetUSDC
    ) external override returns (bytes32 flightId) {
        require(treasury != address(0), "Invalid treasury address");
        require(maxBudgetUSDC > 0, "Max budget must be greater than 0");
        require(bytes(callsign).length > 0, "Invalid callsign");

        flightId = keccak256(abi.encodePacked(callsign, treasury, block.timestamp));
        manifests[flightId] = FlightManifest({
            callsign: callsign,
            aircraftCategory: aircraftCategory,
            treasury: treasury,
            maxBudgetUSDC: maxBudgetUSDC,
            settled: false
        });

        emit FlightManifestRegistered(flightId, callsign, treasury, maxBudgetUSDC);
    }

    /// @notice Settles carbon offsets upon aircraft touchdown (Wheels-Down)
    /// @dev Executes atomic 1inch Aqua zero-custody pull (USDC) and push (offset credit)
    /// @param flightId Unique manifest identifier
    /// @param airborneSeconds Total airborne duration in seconds
    /// @param fuelBurnKg Total fuel burned in kilograms (ICAO standard)
    /// @param co2Kg Calculated CO2 emissions in kilograms
    /// @param usdcAmount USDC payment amount to pull for carbon offset purchase
    function settleWheelsDown(
        bytes32 flightId,
        uint256 airborneSeconds,
        uint256 fuelBurnKg,
        uint256 co2Kg,
        uint256 usdcAmount
    ) external override onlyAgent {
        fuelBurnKg; // Stored in telemetry indexer / calldata for ICAO verification
        FlightManifest storage manifest = manifests[flightId];
        require(manifest.treasury != address(0), "Manifest does not exist");
        require(!manifest.settled, "Already settled");
        require(usdcAmount <= manifest.maxBudgetUSDC, "Exceeds flight budget");

        manifest.settled = true;

        // Zero-custody Aqua settlement: pull USDC from treasury and push carbon credits
        IAqua(aqua).pull(manifest.treasury, usdcAmount);
        IAqua(aqua).push(manifest.treasury, co2Kg);

        emit WheelsDownSettled(flightId, manifest.callsign, airborneSeconds, co2Kg, usdcAmount);
    }
}
