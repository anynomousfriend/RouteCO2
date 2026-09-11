import type { Chain } from "viem";

/**
 * Minimal Arc Testnet chain descriptor. Deliberately NOT imported from
 * arc-client.ts: that module pulls the full viem runtime, which would land in
 * the root layout chunk via Providers and re-trigger ChunkLoadError timeouts.
 * `import type` is fully erased at build time: zero runtime bytes.
 * Ground truth: developers.circle.com: Arc Testnet 5042002, native gas USDC,
 * RPC https://rpc.testnet.arc.network, explorer https://testnet.arcscan.app.
 */
export const arcTestnet: Chain = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
};

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
 * Ground truth: docs.privy.io: Dashboard > Wallet infrastructure > Authorization keys
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
      theme: "light" as const,
      accentColor: "#FF4D00" as `#${string}`,
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
