// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {SkyRouteVault} from "../src/SkyRouteVault.sol";

/**
 * @title DeploySkyRouteVault
 * @notice Foundry script to deploy SkyRouteVault on Arc Testnet (Chain ID 5042002)
 * @dev Usage:
 *   forge script script/DeploySkyRouteVault.s.sol:DeploySkyRouteVault \
 *     --rpc-url https://arc-testnet.drpc.org \
 *     --broadcast -vvvv
 */
contract DeploySkyRouteVault is Script {
    // Canonical 1inch Aqua core registry fallback
    address public constant DEFAULT_AQUA_CORE = 0x111111125421cA6dc452d289314280a0f8842A65;
    // Arc native / testnet USDC
    address public constant DEFAULT_ARC_USDC = 0x3600000000000000000000000000000000000001;

    function run() external returns (address vaultAddress) {
        uint256 deployerPrivateKey;
        
        try vm.envUint("DEPLOYER_PRIVATE_KEY") returns (uint256 key) {
            deployerPrivateKey = key;
        } catch {
            // Default Anvil test key for dry runs and simulations
            deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        }

        address aquaCore;
        try vm.envAddress("NEXT_PUBLIC_AQUA_CORE_ADDRESS") returns (address a) {
            aquaCore = a;
        } catch {
            aquaCore = DEFAULT_AQUA_CORE;
        }

        address usdc;
        try vm.envAddress("NEXT_PUBLIC_USDC_ADDRESS") returns (address u) {
            usdc = u;
        } catch {
            usdc = DEFAULT_ARC_USDC;
        }

        address agent;
        try vm.envAddress("CIRCLE_AGENT_ADDRESS") returns (address ag) {
            agent = ag;
        } catch {
            agent = vm.addr(deployerPrivateKey);
        }

        vm.startBroadcast(deployerPrivateKey);

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

        return address(vault);
    }
}
