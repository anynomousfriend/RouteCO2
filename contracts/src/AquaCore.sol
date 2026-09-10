// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAqua} from "./interfaces/IAqua.sol";

/// @title AquaCore
/// @notice 1inch Aqua shared liquidity registry (Arc Testnet port, interface-conformant with github.com/1inch/aqua)
/// @dev Virtual balances: _balances[maker][app][strategyHash][token]. Tokens stay in maker wallets
///  until pull()/push() executes a real ERC20 safeTransferFrom during swap settlement.
///  Strategies are immutable once shipped; dock() then ship() to change parameters.
interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract AquaCore is IAqua {
    uint8 private constant _DOCKED = 0xff;

    struct Balance {
        uint248 balance;
        uint8 tokensCount;
    }

    mapping(address maker => mapping(address app => mapping(bytes32 strategyHash => mapping(address token => Balance)))) private _balances;

    /// @notice Ships a new immutable strategy allocation with virtual balances
    function ship(address app, bytes calldata strategy, address[] calldata tokens, uint256[] calldata amounts)
        external
        override
        returns (bytes32 strategyHash)
    {
        require(app != address(0), "Invalid app address");
        require(tokens.length == amounts.length, "Tokens/amounts length mismatch");
        require(tokens.length > 0 && tokens.length < _DOCKED, "Invalid tokens count");
        strategyHash = keccak256(strategy);
        uint8 tokensCount = uint8(tokens.length);
        emit Shipped(msg.sender, app, strategyHash, strategy);
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Invalid token address");
            Balance storage bal = _balances[msg.sender][app][strategyHash][tokens[i]];
            require(bal.tokensCount == 0, "Strategy must be immutable");
            bal.balance = uint248(amounts[i]);
            bal.tokensCount = tokensCount;
            emit Pushed(msg.sender, app, strategyHash, tokens[i], amounts[i]);
        }
    }

    /// @notice Docks (closes) a strategy: zeroes virtual balances, accounting only
    function dock(address app, bytes32 strategyHash, address[] calldata tokens) external override {
        for (uint256 i = 0; i < tokens.length; i++) {
            Balance storage bal = _balances[msg.sender][app][strategyHash][tokens[i]];
            require(bal.tokensCount == tokens.length, "Dock must close all tokens");
            bal.balance = 0;
            bal.tokensCount = _DOCKED;
        }
        emit Docked(msg.sender, app, strategyHash);
    }

    /// @notice Pulls tokens from maker to `to` during swap execution (real ERC20 transfer)
    /// @dev Only the app the strategy was shipped for may pull (msg.sender == app).
    function pull(address maker, bytes32 strategyHash, address token, uint256 amount, address to)
        external
        override
    {
        require(maker != address(0) && to != address(0), "Invalid address");
        require(amount > 0, "Amount must be greater than 0");
        Balance storage bal = _balances[maker][msg.sender][strategyHash][token];
        (uint248 prev, uint8 count) = (bal.balance, bal.tokensCount);
        require(count > 0 && count != _DOCKED, "Pull from inactive strategy");
        require(prev >= amount, "Insufficient virtual balance");
        bal.balance = prev - uint248(amount);
        require(IERC20Minimal(token).transferFrom(maker, to, amount), "Pull transfer failed");
        emit Pulled(maker, msg.sender, strategyHash, token, amount);
    }

    /// @notice Pushes tokens from caller into maker's strategy balance (real ERC20 transfer caller -> maker)
    function push(address maker, address app, bytes32 strategyHash, address token, uint256 amount)
        external
        override
    {
        require(maker != address(0) && app != address(0), "Invalid address");
        require(amount > 0, "Amount must be greater than 0");
        Balance storage bal = _balances[maker][app][strategyHash][token];
        (uint248 prev, uint8 count) = (bal.balance, bal.tokensCount);
        require(count > 0 && count != _DOCKED, "Push to inactive strategy");
        bal.balance = prev + uint248(amount);
        require(IERC20Minimal(token).transferFrom(msg.sender, maker, amount), "Push transfer failed");
        emit Pushed(maker, app, strategyHash, token, amount);
    }

    function rawBalances(address maker, address app, bytes32 strategyHash, address token)
        external
        view
        override
        returns (uint248 balance, uint8 tokensCount)
    {
        Balance storage bal = _balances[maker][app][strategyHash][token];
        return (bal.balance, bal.tokensCount);
    }

    function safeBalances(
        address maker,
        address app,
        bytes32 strategyHash,
        address token0,
        address token1
    ) external view override returns (uint256 balance0, uint256 balance1) {
        (uint248 b0, uint8 c0) = this.rawBalances(maker, app, strategyHash, token0);
        require(c0 > 0 && c0 != _DOCKED, "Token not in active strategy");
        (uint248 b1, uint8 c1) = this.rawBalances(maker, app, strategyHash, token1);
        require(c1 > 0 && c1 != _DOCKED, "Token not in active strategy");
        return (uint256(b0), uint256(b1));
    }
}
