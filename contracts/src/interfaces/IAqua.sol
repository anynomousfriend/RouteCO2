// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IAqua
/// @notice 1inch Aqua shared liquidity layer interface (ground truth: github.com/1inch/aqua/src/Aqua.sol)
/// @dev Funds always stay in the maker's wallet. Aqua tracks virtual balances only.
///  ship() creates an immutable strategy allocation, dock() closes it.
///  pull()/push() are swap-execution only and perform real ERC20 transfers.
interface IAqua {
    event Shipped(address indexed maker, address indexed app, bytes32 indexed strategyHash, bytes strategy);
    event Pushed(
        address indexed maker, address indexed app, bytes32 indexed strategyHash, address token, uint256 amount
    );
    event Pulled(
        address indexed maker, address indexed app, bytes32 indexed strategyHash, address token, uint256 amount
    );
    event Docked(address indexed maker, address indexed app, bytes32 indexed strategyHash);

    /// @notice Ships a new immutable liquidity strategy with virtual balances
    /// @param app Aqua App contract the strategy belongs to
    /// @param strategy Opaque strategy bytes (keccak256(strategy) == strategyHash, immutable after ship)
    /// @param tokens Tokens in the strategy
    /// @param amounts Virtual amounts allocated per token
    /// @return strategyHash keccak256(strategy)
    function ship(address app, bytes calldata strategy, address[] calldata tokens, uint256[] calldata amounts)
        external
        returns (bytes32 strategyHash);

    /// @notice Docks (closes) a strategy, zeroing virtual balances (accounting only, no token transfer)
    function dock(address app, bytes32 strategyHash, address[] calldata tokens) external;

    /// @notice Pulls tokens from maker to `to` during swap execution (real ERC20 safeTransferFrom)
    /// @dev Only callable by the Aqua App the strategy was shipped for (msg.sender == app).
    function pull(address maker, bytes32 strategyHash, address token, uint256 amount, address to) external;

    /// @notice Pushes tokens from caller into maker's strategy balance (real ERC20 safeTransferFrom msg.sender -> maker)
    function push(address maker, address app, bytes32 strategyHash, address token, uint256 amount) external;

    /// @notice Raw virtual balance for a single token (no active-strategy check)
    function rawBalances(address maker, address app, bytes32 strategyHash, address token)
        external
        view
        returns (uint248 balance, uint8 tokensCount);

    /// @notice Virtual balances for a token pair, reverts if either token is not in an active strategy
    function safeBalances(
        address maker,
        address app,
        bytes32 strategyHash,
        address token0,
        address token1
    ) external view returns (uint256 balance0, uint256 balance1);
}

/// @title IAquaAppSwapCallback
/// @notice Callback an Aqua App must implement; invoked by the App during swap execution
/// @dev Ground truth: github.com/1inch/aqua — Trader implements aquaAppSwapCallback and push()es tokenIn.
interface IAquaAppSwapCallback {
    function aquaAppSwapCallback(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address maker,
        address app,
        bytes32 strategyHash,
        bytes calldata takerData
    ) external;
}
