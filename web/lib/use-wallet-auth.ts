"use client";

import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { isPrivyConfigured } from "./privy-config";

export interface WalletAuthState {
  ready: boolean;
  authenticated: boolean;
  user: any;
  login: () => void;
  logout: () => void;
  isConfigured: boolean;
}

/**
 * Hook providing unified Web3 wallet authentication.
 * If NEXT_PUBLIC_PRIVY_APP_ID is not configured, gracefully provides fallback
 * without throwing or spamming invalid API requests to auth.privy.io.
 */
export function useWalletAuth(): WalletAuthState {
  if (!isPrivyConfigured) {
    return {
      ready: true,
      authenticated: false,
      user: null,
      isConfigured: false,
      login: () => {
        toast.info("Privy App ID required", {
          description: "Add NEXT_PUBLIC_PRIVY_APP_ID to web/.env.local to activate live Web3 wallet connection.",
          action: {
            label: "Docs",
            onClick: () => window.open("https://dashboard.privy.io", "_blank"),
          },
        });
      },
      logout: () => {},
    };
  }

  // Real Privy provider hook. Guarded: if the provider failed to mount
  // (bad env at runtime, network-blocked auth iframe), degrade to the
  // unconfigured fallback instead of crashing the route.
  try {
    const privy = usePrivy();
    return {
      ...privy,
      isConfigured: true,
    };
  } catch {
    console.warn("[Privy] usePrivy unavailable (provider not mounted); using fallback auth state.");
    return {
      ready: true,
      authenticated: false,
      user: null,
      isConfigured: false,
      login: () => {
        toast.error("Wallet Unavailable", {
          description: "Privy failed to initialize in this environment. Check the app configuration and reload.",
        });
      },
      logout: () => {},
    };
  }
}
