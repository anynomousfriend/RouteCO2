import { arcTestnet } from "./arc-client";

export const isPrivyConfigured = Boolean(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
  process.env.NEXT_PUBLIC_PRIVY_APP_ID.trim().length === 25 &&
  !process.env.NEXT_PUBLIC_PRIVY_APP_ID.startsWith("cl00000000000000000000000")
);

export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cl00000000000000000000000",
  config: {
    appearance: {
      theme: "dark" as const,
      accentColor: "#4C63ED" as `#${string}`, // Copperx Electric Indigo
      showWalletLoginFirst: true,
      logo: "https://copperx.io/copperx.png",
    },
    loginMethods: ["wallet" as const, "email" as const, "google" as const],
    defaultChain: arcTestnet,
    supportedChains: [arcTestnet],
    embeddedWallets: {
      ethereum: {
        createOnLogin: "users-without-wallets" as const,
      },
    },
  },
};
