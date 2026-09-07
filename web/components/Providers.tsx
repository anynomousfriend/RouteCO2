"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { privyConfig, isPrivyConfigured } from "../lib/privy-config";

export default function Providers({ children }: { children: React.ReactNode }) {
  if (!isPrivyConfigured) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider appId={privyConfig.appId} config={privyConfig.config}>
      {children}
    </PrivyProvider>
  );
}
