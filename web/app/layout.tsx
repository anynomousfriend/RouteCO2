import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import Providers from "../components/Providers";

export const metadata: Metadata = {
  title: "RouteCO2 | Autonomous In-Flight Carbon Settlement Protocol",
  description: "Settling verified ICAO carbon offsets the instant a flight lands on Arc via 1inch Aqua and Circle Agent Stack.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#EBEBEB] text-[#000000] min-h-screen antialiased selection:bg-[#7C4DFF]/20 selection:text-[#000000]">
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            theme="light"
            toastOptions={{
              className: "!bg-white !border !border-black/10 !text-black !shadow-2xl !rounded-2xl font-sans",
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
