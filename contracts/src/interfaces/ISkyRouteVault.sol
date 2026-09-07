// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title ISkyRouteVault
/// @notice Interface for SkyRouteVault - 1inch Aqua App for autonomous Wheels-Down carbon offset settlements
interface ISkyRouteVault {
    struct FlightManifest {
        string callsign;
        string aircraftCategory;
        address treasury;
        uint256 maxBudgetUSDC;
        bool settled;
    }

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

    function aqua() external view returns (address);
    function usdc() external view returns (address);
    function owner() external view returns (address);
    function authorizedAgents(address agent) external view returns (bool);
    function manifests(bytes32 flightId) external view returns (
        string memory callsign,
        string memory aircraftCategory,
        address treasury,
        uint256 maxBudgetUSDC,
        bool settled
    );

    function setAuthorizedAgent(address agent, bool authorized) external;

    function registerFlightManifest(
        string calldata callsign,
        string calldata aircraftCategory,
        address treasury,
        uint256 maxBudgetUSDC
    ) external returns (bytes32 flightId);

    function settleWheelsDown(
        bytes32 flightId,
        uint256 airborneSeconds,
        uint256 fuelBurnKg,
        uint256 co2Kg,
        uint256 usdcAmount
    ) external;
}
