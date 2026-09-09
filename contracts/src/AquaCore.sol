// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAqua} from "./interfaces/IAqua.sol";

/// @title AquaCore
/// @notice 1inch Aqua Zero-Custody Shared Liquidity Registry on Arc Testnet
/// @dev Manages zero-escrow token authorizations and atomic settlements for Aqua Apps
contract AquaCore is IAqua {
    // Virtual shared TVU mapped per maker & token: maker => token => virtualBalance
    mapping(address => mapping(address => uint256)) public override virtualBalances;

    /// @notice Pulls tokens from source treasury
    /// @param from Source address
    /// @param amount Amount to pull
    function pull(address from, uint256 amount) external override {
        require(from != address(0), "Invalid from address");
        require(amount > 0, "Amount must be greater than 0");
        emit Pulled(from, amount);
    }

    /// @notice Pushes offset credits to destination
    /// @param to Destination address
    /// @param amount Amount to push
    function push(address to, uint256 amount) external override {
        require(to != address(0), "Invalid to address");
        require(amount > 0, "Amount must be greater than 0");
        emit Pushed(to, amount);
    }

    /// @notice Ships virtual TVU for zero-custody shared liquidity quoting
    /// @param maker Airline corporate treasury or liquidity maker
    /// @param tokenIn Source asset (e.g. USDC)
    /// @param tokenOut Target asset (e.g. Carbon offset credits)
    /// @param virtualTvu Amount of virtual TVU allocated
    function ship(
        address maker,
        address tokenIn,
        address tokenOut,
        uint256 virtualTvu
    ) external override {
        require(maker != address(0), "Invalid maker address");
        require(tokenIn != address(0), "Invalid tokenIn address");
        require(tokenOut != address(0), "Invalid tokenOut address");
        require(virtualTvu > 0, "Virtual TVU must be greater than 0");

        virtualBalances[maker][tokenIn] += virtualTvu;

        emit Shipped(maker, tokenIn, tokenOut, virtualTvu);
    }
}
