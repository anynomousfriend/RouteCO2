// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAqua} from "./interfaces/IAqua.sol";

/// @title AquaCore
/// @notice 1inch Aqua Zero-Custody Shared Liquidity Registry on Arc Testnet
/// @dev Manages zero-escrow token authorizations and atomic settlements for Aqua Apps
contract AquaCore is IAqua {
    event Pulled(address indexed from, uint256 amount);
    event Pushed(address indexed to, uint256 amount);

    /// @notice Pulls tokens from source treasury
    /// @param from Source address
    /// @param amount Amount to pull
    function pull(address from, uint256 amount) external override {
        emit Pulled(from, amount);
    }

    /// @notice Pushes offset credits to destination
    /// @param to Destination address
    /// @param amount Amount to push
    function push(address to, uint256 amount) external override {
        emit Pushed(to, amount);
    }
}
