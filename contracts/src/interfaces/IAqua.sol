// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IAqua
/// @notice 1inch Aqua zero-custody settlement interface
interface IAqua {
    /// @notice Pulls tokens from a source address (e.g. airline treasury)
    /// @param from Address from which tokens are pulled
    /// @param amount Amount of tokens to pull
    function pull(address from, uint256 amount) external;

    /// @notice Pushes tokens/credits to a destination address (e.g. airline treasury)
    /// @param to Address receiving the pushed tokens/credits
    /// @param amount Amount of tokens/credits to push
    function push(address to, uint256 amount) external;
}
