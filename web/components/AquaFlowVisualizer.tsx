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
    <div className="bg-[#ECEBE6] p-3.5 rounded-xl border border-[#D4D3CD] flex flex-col gap-2.5 font-sans">
      {/* Header with 1inch Aqua Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider text-[#111111]">
          <Layers className="w-3.5 h-3.5 text-[#FF4D00]" />
          <span>1INCH AQUA ZERO-CUSTODY PIPELINE</span>
        </div>
        <div className="btn-pill flex items-center gap-1 px-2.5 py-0.5 bg-[#D6D5CF] text-[#111111] border border-[#D4D3CD] text-[10px] font-mono font-semibold">
          <Lock className="w-2.5 h-2.5 text-[#FF4D00]" />
          <span>0% Escrow Float</span>
        </div>
      </div>

      {/* 4-Node Visual State Diagram */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-stretch">
        {/* Node 1: Corporate Treasury */}
        <div
          className={`p-2.5 rounded-lg border transition-[background-color,border-color,opacity] duration-140 flex flex-col justify-between ${
            isSettled
              ? "bg-[#D6D5CF] border-[#D4D3CD]"
              : "bg-[#D6D5CF] border-[#111111]/40"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] text-[#555555] font-mono mb-1">
            <span>1. Self-Custody</span>
            <ShieldCheck className="w-3 h-3 text-[#111111]" />
          </div>
          <div className="font-semibold text-xs text-[#111111]">Airline Treasury</div>
          <div className="text-[10px] text-[#555555] mt-0.5">
            Funds remain in corporate wallet until touchdown. No escrow lockup.
          </div>
        </div>

        {/* Node 2: Sensor Trigger */}
        <div
          className={`p-2.5 rounded-lg border transition-[background-color,border-color,opacity] duration-140 flex flex-col justify-between ${
            isLanded
              ? "bg-[#D6D5CF] border-[#FF4D00]"
              : "bg-[#D6D5CF] border-[#D4D3CD]"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className={isLanded ? "text-[#FF4D00] font-bold" : "text-[#555555]"}>
              2. Sensor Trigger
            </span>
            <Radio className={`w-3 h-3 ${isLanded ? "text-[#FF4D00] animate-pulse" : "text-[#555555]"}`} />
          </div>
          <div className="font-semibold text-xs text-[#111111]">Weight-on-Wheels</div>
          <div className="text-[10px] font-mono text-[#555555] mt-0.5">
            ADS-B <span className={isLanded ? "text-[#FF4D00] font-bold" : ""}>on_ground: {isLanded ? "true 🛬" : "false"}</span>
          </div>
        </div>

        {/* Node 3: 1inch Aqua Settlement */}
        <div
          className={`p-2.5 rounded-lg border transition-[background-color,border-color,opacity] duration-140 flex flex-col justify-between ${
            isSettling
              ? "bg-[#D6D5CF] border-[#FF4D00] animate-pulse"
              : "bg-[#D6D5CF] border-[#D4D3CD]"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className="text-[#555555]">3. Atomic Exec</span>
            <span className="btn-pill text-[9px] font-bold px-1.5 py-0.5 bg-[#ECEBE6] text-[#111111] border border-[#D4D3CD]">AQUA</span>
          </div>
          <div className="font-semibold text-xs text-[#111111]">pull() & push()</div>
          <div className="text-[10px] text-[#555555] mt-0.5">
            {isSettled
              ? `Debited $${usdcAmount.toFixed(2)} USDC atomically on fill.`
              : `Pulls $${usdcAmount.toFixed(2)} USDC & pushes credits in 1 tx.`}
          </div>
        </div>

        {/* Node 4: Verified On-Chain State */}
        <div
          className={`p-2.5 rounded-lg border transition-[background-color,border-color,opacity] duration-140 flex flex-col justify-between ${
            isSettled
              ? "bg-[#D6D5CF] border-[#111111]"
              : "bg-[#D6D5CF] border-[#D4D3CD] opacity-70"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className={isSettled ? "text-[#111111] font-bold" : "text-[#555555]"}>
              4. Proof of Offset
            </span>
            <CheckCircle2 className={`w-3 h-3 ${isSettled ? "text-[#FF4D00]" : "text-[#555555]"}`} />
          </div>
          <div className="font-semibold text-xs text-[#111111]">Arc L1 Finality</div>
          <div className="text-[10px] font-mono text-[#555555] mt-0.5">
            {isSettled
              ? `${(co2Kg / 1000).toFixed(2)}t CO₂ certified on-chain.`
              : "Awaiting touchdown confirmation"}
          </div>
        </div>
      </div>
    </div>
  );
}
