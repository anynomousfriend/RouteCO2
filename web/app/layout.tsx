import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import Providers from "../components/Providers";

export const metadata: Metadata = {
  title: "SkyRoute | Autonomous In-Flight Carbon Settlement Protocol",
  description: "Settling verified ICAO carbon offsets the instant a flight lands on Arc via 1inch Aqua and Circle Agent Stack.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-obsidian-950 text-slate-100 min-h-screen antialiased selection:bg-indigo-500/30 selection:text-white">
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              className: "!bg-obsidian-900 !border !border-indigo-500/30 !text-white !shadow-2xl",
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
