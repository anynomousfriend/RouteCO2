import { arcTestnet } from "./arc-client";

/**
 * Ground truth (@privy-io/react-auth PrivyProvider): the SDK throws
 * "Cannot initialize the Privy provider with an invalid Privy app ID" unless
 * the app ID is a string of exactly 25 characters. Mirror that here so a
 * malformed ID degrades to local-delegation mode instead of 500ing the app.
 */
export const isPrivyConfigured = Boolean(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
  process.env.NEXT_PUBLIC_PRIVY_APP_ID.trim().length === 25 &&
  !process.env.NEXT_PUBLIC_PRIVY_APP_ID.startsWith("cl00000000000000000000000")
);

/**
 * Privy key quorum + policy for scoped flight-manifest session delegation.
 * Ground truth: docs.privy.io — Dashboard > Wallet infrastructure > Authorization keys
 * (key quorum ID) + Policies (contract whitelist + spend cap + expiry); client adds the
 * quorum via useSigners().addSigners({ address, signers: [{ signerId, policyIds }] }).
 * Missing values mean delegation falls back to explicit local state (labeled in UI).
 */
export const PRIVY_KEY_QUORUM_ID = process.env.NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID || "";
export const PRIVY_POLICY_ID = process.env.NEXT_PUBLIC_PRIVY_POLICY_ID || "";
export const isSessionSignerConfigured = Boolean(isPrivyConfigured && PRIVY_KEY_QUORUM_ID);

export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cl00000000000000000000000",
  config: {
    appearance: {
      theme: "dark" as const,
      accentColor: "#7C4DFF" as `#${string}`, // RouteCO2 Violet
      showWalletLoginFirst: true,
      logo: "/favicon.svg",
    },
    // Passkey-first dispatcher onboarding (<3s biometric) with wallet + email fallback.
    loginMethods: ["passkey" as const, "wallet" as const, "email" as const],
    defaultChain: arcTestnet,
    supportedChains: [arcTestnet],
    embeddedWallets: {
      ethereum: {
        createOnLogin: "all-users" as const,
      },
    },
  },
};
