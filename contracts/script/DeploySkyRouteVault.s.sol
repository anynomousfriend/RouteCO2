// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {SkyRouteVault} from "../src/SkyRouteVault.sol";
import {AquaCore} from "../src/AquaCore.sol";

/**
 * @title DeploySkyRouteVault
 * @notice Foundry deployment script for SkyRouteVault & AquaCore on Arc Testnet (Chain ID 5042002)
 * @dev Usage:
 *   forge script script/DeploySkyRouteVault.s.sol:DeploySkyRouteVault \
 *     --rpc-url https://rpc.testnet.arc.network \
 *     --broadcast -vvvv
 */
contract DeploySkyRouteVault is Script {
    // Arc native / testnet USDC precompile / identifier
    address public constant DEFAULT_ARC_USDC = 0x3600000000000000000000000000000000000001;

    function run() external returns (address vaultAddress, address aquaAddress) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        require(deployerPrivateKey != 0, "Missing DEPLOYER_PRIVATE_KEY in environment");

        address aquaCore = vm.envOr("NEXT_PUBLIC_AQUA_CORE_ADDRESS", address(0));
        address usdc = vm.envOr("NEXT_PUBLIC_USDC_ADDRESS", DEFAULT_ARC_USDC);
        address agent = vm.envOr("CIRCLE_AGENT_ADDRESS", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);

        // If no Aqua Core registry is provided or address has no code, deploy live AquaCore
        if (aquaCore == address(0) || aquaCore.code.length == 0) {
            AquaCore deployedAqua = new AquaCore();
            aquaCore = address(deployedAqua);
            console2.log("AquaCore Deployed at: ", aquaCore);
        }

        SkyRouteVault vault = new SkyRouteVault(aquaCore, usdc);
        vault.setAuthorizedAgent(agent, true);

        vm.stopBroadcast();

        console2.log("==================================================");
        console2.log("SkyRouteVault Deployed to Arc Testnet (5042002)");
        console2.log("Vault Address:       ", address(vault));
        console2.log("Aqua Registry:       ", aquaCore);
        console2.log("USDC Token:          ", usdc);
        console2.log("Authorized Agent:    ", agent);
        console2.log("==================================================");

        return (address(vault), aquaCore);
    }
}
