"use client";

import React from "react";
import dynamic from "next/dynamic";
import { privyConfig, isPrivyConfigured } from "../lib/privy-config";

/**
 * Privy is ~2MB+ (wagmi/viem). Loading it statically inside the root layout
 * balloons app/layout.js (observed 18MB dev chunk) and trips ChunkLoadError
 * timeouts. Load it in a separate async client-only chunk instead; children
 * render immediately so SSR/landing content never flashes or blocks.
 */
const PrivyProviderNoSSR = dynamic(
  () =>
    import("@privy-io/react-auth").then((mod) => ({
      default: mod.PrivyProvider,
    })),
  { ssr: false }
);

/**
 * Catches Privy initialization crashes (e.g. malformed NEXT_PUBLIC_PRIVY_APP_ID)
 * so one bad env var degrades to local-delegation mode instead of 500ing the app.
 */
class PrivyGuard extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.warn("[Privy] Provider failed to initialize, running without embedded wallets:", err);
  }

  render() {
    if (this.state.failed) return <>{this.props.children}</>;
    return <>{this.props.children}</>;
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  if (!isPrivyConfigured) {
    return <>{children}</>;
  }

  return (
    <PrivyGuard>
      <PrivyProviderNoSSR appId={privyConfig.appId} config={privyConfig.config}>
        {children}
      </PrivyProviderNoSSR>
    </PrivyGuard>
  );
}
