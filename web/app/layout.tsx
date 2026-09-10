import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import Providers from "../components/Providers";
import { AgentationToolbar } from "../components/AgentationToolbar";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://routeco2.vercel.app"),
  title: "RouteCO2 | Autonomous In-Flight Carbon Settlement Protocol",
  description: "Settling verified ICAO carbon offsets the instant a flight lands on Arc via 1inch Aqua and Circle Agent Stack.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "RouteCO2 | Autonomous In-Flight Carbon Settlement Protocol",
    description: "Settling verified ICAO carbon offsets the instant a flight lands on Arc via 1inch Aqua and Circle Agent Stack.",
    images: [
      {
        url: "/cover.png",
        width: 1280,
        height: 720,
        alt: "RouteCO2 Cover Banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RouteCO2 | Autonomous In-Flight Carbon Settlement Protocol",
    description: "Settling verified ICAO carbon offsets the instant a flight lands on Arc via 1inch Aqua and Circle Agent Stack.",
    images: ["/cover.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#2d353b] text-[#d3c6aa] min-h-screen antialiased selection:bg-[#83c092] selection:text-[#2d353b] font-mono">
        <Providers>
          {children}
          <AgentationToolbar />
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              className:
                "!bg-[#1e2528] !border !border-dashed !border-[#d3c6aa]/20 !text-[#d3c6aa] !shadow-2xl !rounded-lg font-mono",
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
