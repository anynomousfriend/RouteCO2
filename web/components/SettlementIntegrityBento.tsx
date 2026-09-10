"use client";

import React from "react";
import { ShieldCheck, ExternalLink, CheckCircle2 } from "lucide-react";

interface SettlementIntegrityBentoProps {
  isSettled: boolean;
  isSettling: boolean;
  settlementTxHash?: string;
  blockNumber?: number;
  runway: string;
  destinationAirport: string;
  className?: string;
}

export function SettlementIntegrityBento({
  isSettled,
  isSettling,
  settlementTxHash,
  blockNumber,
  runway,
  destinationAirport,
  className = "",
}: SettlementIntegrityBentoProps) {
  // Stepped blocks telemetry data (06:00, 09:00, 12:00, 15:00, 18:00, 21:00)
  const steps = [
    { time: "06:00", val: 40, status: "amber" },
    { time: "09:00", val: 32, status: "amber" },
    { time: "12:00", val: 55, status: "green" },
    { time: "15:00", val: 68, status: "green" },
    { time: "18:00", val: 82, status: "green" },
    { time: "21:00", val: 95, status: isSettled ? "green" : "amber" },
  ];

  return (
    <div
      className={`w-full bg-[#1e2528] text-[#d3c6aa] p-4 border border-dashed border-[#d3c6aa]/16 flex flex-col justify-between select-none font-mono ${className}`}
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#9daaa4]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#a7c080]" />
            <span className="uppercase tracking-wider">Settlement Integrity Status</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className="w-1.5 h-1.5 bg-[#a7c080] blink-step" />
            <span className="text-[#a7c080] font-bold">Arc L1 5042002</span>
          </div>
        </div>

        {/* Stepped Area / Candlestick Chart */}
        <div className="relative h-20 w-full flex items-end justify-between gap-2 pt-2 pb-1 border-b border-dashed border-[#d3c6aa]/16">
          {steps.map((step, idx) => {
            const isGreen = step.status === "green";
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                <div className="w-full flex items-end justify-center h-full">
                  <div
                    style={{ height: `${step.val}%` }}
                    className={`w-full max-w-[20px] transition-[height,background-color] duration-300 ${
                      isGreen
                        ? "bg-[#a7c080]/80 group-hover:bg-[#a7c080]"
                        : "bg-[#dbbc7f]/80 group-hover:bg-[#dbbc7f]"
                    }`}
                  />
                </div>
                <span className="text-[9px] font-mono text-[#859289]">{step.time}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Narrative Status Footer */}
      <div className="mt-3 flex items-start gap-2.5 text-[11px] leading-snug">
        <div className="w-6 h-6 bg-[#a7c080]/10 border border-dashed border-[#a7c080]/30 flex items-center justify-center shrink-0 mt-0.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#a7c080]" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-[10.5px] text-[#9daaa4] leading-relaxed">
            {isSettled ? (
              <>
                Wheels-Down transponder signal verified on Runway {runway} ({destinationAirport}). 1inch Aqua zero-custody draw confirmed on Arc Testnet {blockNumber ? `Block #${blockNumber}` : "Receipt"} with zero escrow lockup.
              </>
            ) : isSettling ? (
              <>
                Broadcasting wheels-down atomic offset transaction to Arc Testnet via Circle Paymaster...
              </>
            ) : (
              <>
                Aviation transponder lock established. Settlement policy enforced: $500 max budget cap, 0% upfront escrow float.
              </>
            )}
          </p>
          {settlementTxHash && (
            <a
              href={`https://testnet.arcscan.app/tx/${settlementTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-mono text-[#7fbbb3] hover:underline pt-0.5"
            >
              <span>Verify {blockNumber ? `Block #${blockNumber}` : "Receipt"} on ArcScan</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
