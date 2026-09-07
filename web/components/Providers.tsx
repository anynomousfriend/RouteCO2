"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { privyConfig } from "../lib/privy-config";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider appId={privyConfig.appId} config={privyConfig.config}>
      {children}
    </PrivyProvider>
  );
}
