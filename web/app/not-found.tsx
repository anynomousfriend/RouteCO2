"use client";

import Link from "next/link";
import { Radio, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#ECEBE6] text-[#111111] flex flex-col items-center justify-center p-6 selection:bg-[#FF4D00] selection:text-white font-sans">
      <div className="w-full max-w-lg bg-[#ECEBE6] border border-[#D4D3CD] rounded-2xl p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_24px_rgba(0,0,0,0.04)] text-center relative overflow-hidden">
        {/* Subtle Radar Crosshair Accent */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full border border-[#D4D3CD] opacity-40 pointer-events-none" />
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full border border-[#D4D3CD] opacity-40 pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D6D5CF] border border-[#D4D3CD] text-[11px] font-mono text-[#555555] mb-6">
          <span className="w-2 h-2 rounded-full bg-[#FF4D00] animate-ping" />
          <span>SQUAWK 7600 : RADIO CONTACT LOST</span>
        </div>

        <div className="font-mono text-7xl font-bold tracking-tighter text-[#111111] mb-2 tabular-nums">
          404
        </div>

        <h1 className="text-xl font-bold text-[#111111] tracking-tight mb-3">
          Flight path not found on radar
        </h1>

        <p className="text-xs text-[#555555] leading-relaxed max-w-sm mx-auto mb-8 font-sans">
          The requested waypoint, flight manifest, or sector is not indexed on the active dispatch grid. Check the URL or return to operations.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 font-sans">
          <Link
            href="/app"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#111111] hover:bg-[#FF4D00] text-[#ECEBE6] text-xs font-semibold tracking-wide transition-all active:scale-[0.98]"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Enter radar console</span>
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#ECEBE6] hover:bg-[#D6D5CF] text-[#111111] border border-[#D4D3CD] text-xs font-semibold tracking-wide transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to overview</span>
          </Link>
        </div>
      </div>

      <div className="mt-8 text-[11px] font-mono text-[#777777]">
        ROUTECO2 : AUTONOMOUS FLIGHT EMISSIONS PROTOCOL
      </div>
    </div>
  );
}
