"use client";

/**
 * Privy scoped session delegation (Track 3).
 * Ground truth: docs.privy.io: signers let the app transact on a user's embedded
 * wallet offline within a policy (contract whitelist + spend cap + expiry):
 * 1. Dashboard: Authorization keys -> key quorum ID; Policies -> policy ID.
 * 2. Client (after login + embedded wallet): useSigners().addSigners({ address,
 *    signers: [{ signerId: quorumId, policyIds: [policyId] }] }).
 * 3. Server: Privy Node SDK / REST with the quorum private key executes bounded
 *    transactions (see docs.privy.io/wallets/using-wallets/signers/use-signers).
 * This hook wraps step 2 with fail-loud errors and exposes delegation state.
 * Policy contents (SkyRouteVault whitelist, per-flight cap, 8h expiry) are configured
 * in the Privy Dashboard; the IDs are read from env (see lib/privy-config.ts).
 */

import { useCallback, useState } from "react";
import { useSigners, useHeadlessDelegatedActions } from "@privy-io/react-auth";
import { PRIVY_KEY_QUORUM_ID, PRIVY_POLICY_ID, isSessionSignerConfigured } from "./privy-config";

export interface SessionDelegationResult {
  delegated: boolean;
  isSignerConfigured: boolean;
  keyQuorumId: string;
  policyId: string;
  error: string | null;
  addSessionSigner: (walletAddress: string) => Promise<void>;
  delegateWalletServerAccess: (walletAddress: string) => Promise<void>;
}

export function useFlightSessionDelegation(): SessionDelegationResult {
  // These hooks throw when no PrivyProvider is mounted (e.g. production env
  // without NEXT_PUBLIC_PRIVY_APP_ID). Call them unconditionally to preserve
  // hook order, but fall back to stubs so the route survives unconfigured env.
  // addSessionSigner re-checks isSessionSignerConfigured and throws a helpful
  // error before the stubs could ever be invoked.
  let addSigners: (args: {
    address: string;
    signers: { signerId: string; policyIds: string[] }[];
  }) => Promise<unknown>;
  let delegateWallet: (args: { address: string; chainType: "ethereum" }) => Promise<unknown>;
  try {
    addSigners = useSigners().addSigners;
  } catch {
    addSigners = async () => {
      throw new Error("Privy session signers unavailable: provider not mounted.");
    };
  }
  try {
    delegateWallet = useHeadlessDelegatedActions().delegateWallet;
  } catch {
    delegateWallet = async () => {
      throw new Error("Privy delegation unavailable: provider not mounted.");
    };
  }
  const [delegated, setDelegated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSessionSigner = useCallback(
    async (walletAddress: string) => {
      if (!isSessionSignerConfigured) {
        throw new Error(
          "Privy session signer not configured: set NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID (and NEXT_PUBLIC_PRIVY_POLICY_ID for bounded policy) in web/.env.local."
        );
      }
      if (!walletAddress) throw new Error("addSessionSigner: walletAddress is required");
      setError(null);
      try {
        await addSigners({
          address: walletAddress,
          signers: [
            {
              signerId: PRIVY_KEY_QUORUM_ID,
              policyIds: PRIVY_POLICY_ID ? [PRIVY_POLICY_ID] : [],
            },
          ],
        });
        setDelegated(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw new Error(`Privy addSigners failed: ${msg}`);
      }
    },
    [addSigners]
  );

  const delegateWalletServerAccess = useCallback(
    async (walletAddress: string) => {
      if (!walletAddress) throw new Error("delegateWallet: walletAddress is required");
      setError(null);
      try {
        await delegateWallet({ address: walletAddress, chainType: "ethereum" });
        setDelegated(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw new Error(`Privy delegateWallet failed: ${msg}`);
      }
    },
    [delegateWallet]
  );

  return {
    delegated,
    isSignerConfigured: isSessionSignerConfigured,
    keyQuorumId: PRIVY_KEY_QUORUM_ID,
    policyId: PRIVY_POLICY_ID,
    error,
    addSessionSigner,
    delegateWalletServerAccess,
  };
}
