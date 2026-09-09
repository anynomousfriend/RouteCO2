"use client";

import React from "react";
import { ShieldCheck, Radio, ArrowRight, Layers, CheckCircle2, Lock } from "lucide-react";

interface AquaFlowVisualizerProps {
  isLanded: boolean;
  isSettled: boolean;
  isSettling: boolean;
  usdcAmount: number;
  co2Kg: number;
}

export function AquaFlowVisualizer({
  isLanded,
  isSettled,
  isSettling,
  usdcAmount,
  co2Kg,
}: AquaFlowVisualizerProps) {
  return (
    <div className="bg-neutral-50 rounded-xl p-3 border border-black/5 flex flex-col gap-2.5">
      {/* Header with 1inch Aqua Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider text-black">
          <Layers className="w-3.5 h-3.5 text-[#007AFF]" />
          <span>1INCH AQUA ZERO-CUSTODY PIPELINE</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-semibold">
          <Lock className="w-2.5 h-2.5" />
          <span>0% Escrow Float</span>
        </div>
      </div>

      {/* 4-Node Visual State Diagram */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-stretch">
        {/* Node 1: Corporate Treasury */}
        <div
          className={`p-2.5 rounded-lg border transition-[background-color,border-color,box-shadow,opacity] duration-140 flex flex-col justify-between ${
            isSettled
              ? "bg-white border-black/10"
              : "bg-white border-[#007AFF]/30 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] text-[#666666] font-mono mb-1">
            <span>1. Self-Custody</span>
            <ShieldCheck className="w-3 h-3 text-[#007AFF]" />
          </div>
          <div className="font-semibold text-xs text-black">Airline Treasury</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            Funds remain in corporate wallet until touchdown. No escrow lockup.
          </div>
        </div>

        {/* Node 2: Sensor Trigger */}
        <div
          className={`p-2.5 rounded-lg border transition-[background-color,border-color,box-shadow,opacity] duration-140 flex flex-col justify-between ${
            isLanded
              ? "bg-emerald-50/60 border-emerald-400/50 shadow-xs"
              : "bg-white border-black/10"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className={isLanded ? "text-emerald-700 font-bold" : "text-[#666666]"}>
              2. Sensor Trigger
            </span>
            <Radio className={`w-3 h-3 ${isLanded ? "text-emerald-600 animate-pulse" : "text-neutral-400"}`} />
          </div>
          <div className="font-semibold text-xs text-black">Weight-on-Wheels</div>
          <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
            ADS-B <span className={isLanded ? "text-emerald-600 font-bold" : ""}>on_ground: {isLanded ? "true 🛬" : "false"}</span>
          </div>
        </div>

        {/* Node 3: 1inch Aqua Settlement */}
        <div
          className={`p-2.5 rounded-lg border transition-[background-color,border-color,box-shadow,opacity] duration-140 flex flex-col justify-between ${
            isSettling
              ? "bg-amber-50 border-amber-300 animate-pulse"
              : isSettled
              ? "bg-white border-black/10"
              : "bg-white border-black/10"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className="text-[#666666]">3. Atomic Exec</span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700">AQUA</span>
          </div>
          <div className="font-semibold text-xs text-black">pull() & push()</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            {isSettled
              ? `Debited $${usdcAmount.toFixed(2)} USDC atomically on fill.`
              : `Pulls $${usdcAmount.toFixed(2)} USDC & pushes credits in 1 tx.`}
          </div>
        </div>

        {/* Node 4: Verified On-Chain State */}
        <div
          className={`p-2.5 rounded-lg border transition-[background-color,border-color,box-shadow,opacity] duration-140 flex flex-col justify-between ${
            isSettled
              ? "bg-emerald-50 border-emerald-500 shadow-sm"
              : "bg-white border-black/10 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className={isSettled ? "text-emerald-700 font-bold" : "text-[#666666]"}>
              4. Proof of Offset
            </span>
            <CheckCircle2 className={`w-3 h-3 ${isSettled ? "text-emerald-600" : "text-neutral-400"}`} />
          </div>
          <div className="font-semibold text-xs text-black">Arc L1 Finality</div>
          <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
            {isSettled
              ? `${(co2Kg / 1000).toFixed(2)}t CO₂ certified on-chain.`
              : "Awaiting touchdown confirmation"}
          </div>
        </div>
      </div>
    </div>
  );
}
