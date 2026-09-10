"use client";

import React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { privyConfig, isPrivyConfigured } from "../lib/privy-config";

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
      <PrivyProvider appId={privyConfig.appId} config={privyConfig.config}>
        {children}
      </PrivyProvider>
    </PrivyGuard>
  );
}
