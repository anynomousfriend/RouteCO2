// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {SkyRouteVault} from "../src/SkyRouteVault.sol";
import {AquaCore} from "../src/AquaCore.sol";
import {SwapVMRuleEngine} from "../src/SwapVMRuleEngine.sol";

/**
 * @title DeploySkyRouteVault
 * @notice Foundry deployment script for SkyRouteVault, AquaCore & SwapVMRuleEngine on Arc Testnet (Chain ID 5042002)
 * @dev Ground truth: github.com/1inch/aqua (ship/dock/pull/push), github.com/1inch/swap-vm
 *  (router 0x111111338c5091E8440b67B168bAe16a668AC0De — NOT deployed on Arc, so this repo
 *  deploys an interface-conformant AquaCore port + Arc-local SwapVMRuleEngine projection).
 *  Circle Arc Testnet USDC ERC-20: 0x3600000000000000000000000000000000000000 (also precompile .0001).
 *  Usage:
 *   forge script script/DeploySkyRouteVault.s.sol:DeploySkyRouteVault \
 *     --rpc-url https://rpc.testnet.arc.network \
 *     --broadcast -vvvv
 */
contract DeploySkyRouteVault is Script {
    // Circle Arc Testnet USDC ERC-20 (ground truth: developers.circle.com ARC-TESTNET transfer guide)
    address public constant DEFAULT_ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external returns (address vaultAddress, address aquaAddress, address swapVmAddress) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        require(deployerPrivateKey != 0, "Missing DEPLOYER_PRIVATE_KEY in environment");

        address aquaCore = vm.envOr("NEXT_PUBLIC_AQUA_CORE_ADDRESS", address(0));
        address usdc = vm.envOr("NEXT_PUBLIC_USDC_ADDRESS", DEFAULT_ARC_USDC);
        address swapVmRuleEngine = vm.envOr("NEXT_PUBLIC_SWAPVM_ENGINE_ADDRESS", address(0));
        address agent = vm.envOr("CIRCLE_AGENT_ADDRESS", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);

        // Deploy SwapVMRuleEngine if not provided or has no code
        if (swapVmRuleEngine == address(0) || swapVmRuleEngine.code.length == 0) {
            SwapVMRuleEngine engine = new SwapVMRuleEngine();
            swapVmRuleEngine = address(engine);
            console2.log("SwapVMRuleEngine Deployed at: ", swapVmRuleEngine);
        }

        bool forceDeployAqua = vm.envOr("FORCE_DEPLOY_AQUA", false);

        // If no Aqua Core registry is provided or address has no code or forceDeployAqua is set, deploy live AquaCore
        if (forceDeployAqua || aquaCore == address(0) || aquaCore.code.length == 0) {
            AquaCore deployedAqua = new AquaCore();
            aquaCore = address(deployedAqua);
            console2.log("AquaCore Deployed at: ", aquaCore);
        }

        SkyRouteVault vault = new SkyRouteVault(aquaCore, usdc, swapVmRuleEngine);
        vault.setAuthorizedAgent(agent, true);

        vm.stopBroadcast();

        console2.log("==================================================");
        console2.log("SkyRouteVault Deployed to Arc Testnet (5042002)");
        console2.log("Vault Address:       ", address(vault));
        console2.log("SwapVM Engine:       ", swapVmRuleEngine);
        console2.log("Aqua Registry:       ", aquaCore);
        console2.log("USDC Token:          ", usdc);
        console2.log("Authorized Agent:    ", agent);
        console2.log("==================================================");

        return (address(vault), aquaCore, swapVmRuleEngine);
    }
}
