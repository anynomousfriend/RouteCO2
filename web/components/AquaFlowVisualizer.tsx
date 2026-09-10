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
    <div className="bg-[#1e2528] p-3 border border-dashed border-[#d3c6aa]/16 flex flex-col gap-2.5 font-mono">
      {/* Header with 1inch Aqua Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider text-[#d3c6aa]">
          <Layers className="w-3.5 h-3.5 text-[#7fbbb3]" />
          <span>1INCH AQUA ZERO-CUSTODY PIPELINE</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 bg-[#a7c080]/15 text-[#a7c080] border border-dashed border-[#a7c080]/40 text-[10px] font-mono font-semibold">
          <Lock className="w-2.5 h-2.5" />
          <span>0% Escrow Float</span>
        </div>
      </div>

      {/* 4-Node Visual State Diagram */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-stretch">
        {/* Node 1: Corporate Treasury */}
        <div
          className={`p-2.5 border transition-[background-color,border-color,opacity] duration-140 flex flex-col justify-between ${
            isSettled
              ? "bg-[#2d353b] border-dashed border-[#d3c6aa]/16"
              : "bg-[#2d353b] border-dashed border-[#7fbbb3]/40"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] text-[#859289] font-mono mb-1">
            <span>1. Self-Custody</span>
            <ShieldCheck className="w-3 h-3 text-[#7fbbb3]" />
          </div>
          <div className="font-semibold text-xs text-[#d3c6aa]">Airline Treasury</div>
          <div className="text-[10px] text-[#859289] mt-0.5">
            Funds remain in corporate wallet until touchdown. No escrow lockup.
          </div>
        </div>

        {/* Node 2: Sensor Trigger */}
        <div
          className={`p-2.5 border transition-[background-color,border-color,opacity] duration-140 flex flex-col justify-between ${
            isLanded
              ? "bg-[#a7c080]/[0.08] border-dashed border-[#a7c080]/50"
              : "bg-[#2d353b] border-dashed border-[#d3c6aa]/16"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className={isLanded ? "text-[#a7c080] font-bold" : "text-[#859289]"}>
              2. Sensor Trigger
            </span>
            <Radio className={`w-3 h-3 ${isLanded ? "text-[#a7c080] blink-step" : "text-[#859289]"}`} />
          </div>
          <div className="font-semibold text-xs text-[#d3c6aa]">Weight-on-Wheels</div>
          <div className="text-[10px] font-mono text-[#859289] mt-0.5">
            ADS-B <span className={isLanded ? "text-[#a7c080] font-bold" : ""}>on_ground: {isLanded ? "true 🛬" : "false"}</span>
          </div>
        </div>

        {/* Node 3: 1inch Aqua Settlement */}
        <div
          className={`p-2.5 border transition-[background-color,border-color,opacity] duration-140 flex flex-col justify-between ${
            isSettling
              ? "bg-[#dbbc7f]/[0.08] border-dashed border-[#dbbc7f]/50 blink-step"
              : isSettled
              ? "bg-[#2d353b] border-dashed border-[#d3c6aa]/16"
              : "bg-[#2d353b] border-dashed border-[#d3c6aa]/16"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className="text-[#859289]">3. Atomic Exec</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#d3c6aa]/10 text-[#9daaa4]">AQUA</span>
          </div>
          <div className="font-semibold text-xs text-[#d3c6aa]">pull() & push()</div>
          <div className="text-[10px] text-[#859289] mt-0.5">
            {isSettled
              ? `Debited $${usdcAmount.toFixed(2)} USDC atomically on fill.`
              : `Pulls $${usdcAmount.toFixed(2)} USDC & pushes credits in 1 tx.`}
          </div>
        </div>

        {/* Node 4: Verified On-Chain State */}
        <div
          className={`p-2.5 border transition-[background-color,border-color,opacity] duration-140 flex flex-col justify-between ${
            isSettled
              ? "bg-[#a7c080]/[0.08] border-dashed border-[#a7c080]/60"
              : "bg-[#2d353b] border-dashed border-[#d3c6aa]/16 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className={isSettled ? "text-[#a7c080] font-bold" : "text-[#859289]"}>
              4. Proof of Offset
            </span>
            <CheckCircle2 className={`w-3 h-3 ${isSettled ? "text-[#a7c080]" : "text-[#859289]"}`} />
          </div>
          <div className="font-semibold text-xs text-[#d3c6aa]">Arc L1 Finality</div>
          <div className="text-[10px] font-mono text-[#859289] mt-0.5">
            {isSettled
              ? `${(co2Kg / 1000).toFixed(2)}t CO₂ certified on-chain.`
              : "Awaiting touchdown confirmation"}
          </div>
        </div>
      </div>
    </div>
  );
}
