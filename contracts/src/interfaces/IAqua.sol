// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IAqua
/// @notice 1inch Aqua zero-custody settlement and shared liquidity interface
interface IAqua {
    event Pulled(address indexed from, uint256 amount);
    event Pushed(address indexed to, uint256 amount);
    event Shipped(address indexed maker, address indexed tokenIn, address indexed tokenOut, uint256 virtualTvu);

    /// @notice Pulls tokens from a source address (e.g. airline treasury)
    /// @param from Address from which tokens are pulled
    /// @param amount Amount of tokens to pull
    function pull(address from, uint256 amount) external;

    /// @notice Pushes tokens/credits to a destination address (e.g. airline treasury)
    /// @param to Address receiving the pushed tokens/credits
    /// @param amount Amount of tokens/credits to push
    function push(address to, uint256 amount) external;

    /// @notice Ships virtual liquidity / TVU for zero-custody shared balance quoting
    /// @param maker Address of the liquidity maker (airline treasury)
    /// @param tokenIn Asset being offered
    /// @param tokenOut Asset being requested
    /// @param virtualTvu Amount of virtual TVU allocated
    function ship(address maker, address tokenIn, address tokenOut, uint256 virtualTvu) external;

    /// @notice Queries virtual balance allocated for a maker and token
    /// @param maker Address of the maker
    /// @param token Address of the token
    /// @return Balance of virtual TVU
    function virtualBalances(address maker, address token) external view returns (uint256);
}
