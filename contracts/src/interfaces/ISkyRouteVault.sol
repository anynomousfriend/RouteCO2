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
        bytes swapVmBytecode;
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
    event FeesWithdrawn(address indexed to, uint256 amount);
    event AquaSwapExecuted(address indexed tokenIn, uint256 amountIn, address indexed tokenOut, uint256 amountOut);

    function aqua() external view returns (address);
    function usdc() external view returns (address);
    function swapVmRuleEngine() external view returns (address);
    function owner() external view returns (address);
    function authorizedAgents(address agent) external view returns (bool);
    function manifests(bytes32 flightId) external view returns (
        string memory callsign,
        string memory aircraftCategory,
        address treasury,
        uint256 maxBudgetUSDC,
        bytes memory swapVmBytecode,
        bool settled
    );

    function setAuthorizedAgent(address agent, bool authorized) external;

    function registerFlightManifest(
        string calldata callsign,
        string calldata aircraftCategory,
        address treasury,
        uint256 maxBudgetUSDC,
        bytes calldata swapVmBytecode
    ) external returns (bytes32 flightId);

    function registerFlightManifest(
        string calldata callsign,
        string calldata aircraftCategory,
        address treasury,
        uint256 maxBudgetUSDC
    ) external returns (bytes32 flightId);

    function totalCarbonOffsetKg(address treasury) external view returns (uint256);

    function settleWheelsDown(
        bytes32 flightId,
        uint256 airborneSeconds,
        uint256 fuelBurnKg,
        uint256 co2Kg,
        uint256 usdcAmount
    ) external payable;

    function withdrawFees(address payable to, uint256 amount) external;

    function aquaAppSwapCallback(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut,
        bytes calldata data
    ) external;
}
