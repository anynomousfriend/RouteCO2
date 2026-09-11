import type { Metadata } from "next";
import "./globals.css";
import Providers from "../components/Providers";
import { AgentationToolbar } from "../components/AgentationToolbar";
import { SonnerToaster } from "../components/SonnerToaster";

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
      <body className="bg-[#ECEBE6] text-[#111111] min-h-screen antialiased selection:bg-[#FF4D00] selection:text-white font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#111111] focus:text-[#ECEBE6] focus:rounded-md focus:border focus:border-[#FF4D00] focus:shadow-lg text-xs font-mono"
        >
          Skip to content
        </a>
        <Providers>
          {children}
          <AgentationToolbar />
          <SonnerToaster />
        </Providers>
      </body>
    </html>
  );
}
