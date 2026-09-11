"use client";

import React from "react";
import { Maximize2, Fuel } from "lucide-react";
import NumberFlow from "@number-flow/react";

interface FuelDynamicsBentoProps {
  currentFuelBurnRateKgS: number;
  benchmarkBurnRateKgS: number;
  airborneSeconds: number;
  fuelBurnKg: number;
  className?: string;
}

export function FuelDynamicsBento({
  currentFuelBurnRateKgS,
  benchmarkBurnRateKgS,
  airborneSeconds,
  fuelBurnKg,
  className = "",
}: FuelDynamicsBentoProps) {
  // Sample approach telemetry bars (Cruise -> Descent -> Hold -> Approach -> Flare)
  const barData = [
    { label: "CRZ", burn: 0.67, base: 0.65 },
    { label: "DES", burn: 0.52, base: 0.60 },
    { label: "FL240", burn: 0.58, base: 0.62 },
    { label: "FL100", burn: 0.71, base: 0.66 },
    { label: "APP", burn: 0.84, base: 0.72 },
    { label: "FLARE", burn: 0.92, base: 0.75 },
    { label: "TD", burn: 0.45, base: 0.50 },
    { label: "TAXI", burn: 0.28, base: 0.32 },
  ];

  const maxVal = 1.0;

  return (
    <div
      className={`w-full bg-[#D6D5CF] text-[#111111] p-4 rounded-xl border border-[#D4D3CD] flex flex-col justify-between select-none font-sans ${className}`}
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Fuel className="w-3.5 h-3.5 text-[#FF4D00]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#111111]">
              Fuel Flow Dynamics
            </span>
          </div>
          <button
            type="button"
            className="icon-circle p-1 text-[#555555] hover:text-[#111111] cursor-pointer transition-colors"
            title="Expand Analytics"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>

        {/* Dynamic Dual-Color Bar Chart */}
        <div className="relative h-20 w-full flex items-end justify-between gap-1.5 pt-2 pb-1 border-b border-[#D4D3CD]">
          {barData.map((d, i) => {
            const hBurn = Math.min(100, Math.max(15, (d.burn / maxVal) * 100));
            const hBase = Math.min(100, Math.max(10, (d.base / maxVal) * 100));
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                <div className="w-full flex items-end justify-center gap-0.5 h-full">
                  {/* Actual Instantaneous Burn (Orange Bar) */}
                  <div
                    style={{ height: `${hBurn}%` }}
                    className="w-1.5 sm:w-2 bg-[#FF4D00] rounded-t-sm transition-[height,filter] duration-300 group-hover:brightness-110"
                  />
                  {/* Benchmark Standard (Neutral Charcoal Bar) */}
                  <div
                    style={{ height: `${hBase}%` }}
                    className="w-1.5 sm:w-2 bg-[#111111]/20 rounded-t-sm transition-[height] duration-300"
                  />
                </div>
                <span className="text-[9px] font-mono text-[#555555] uppercase">{d.label}</span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-[10px] text-[#555555] mt-2 px-1 font-sans">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#FF4D00]" />
              <span>Thrust Burn</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#111111]/20" />
              <span>ICAO Base</span>
            </span>
          </div>
          <div className="font-bold font-mono text-[#111111]">
            <NumberFlow value={fuelBurnKg} /> <span className="font-normal text-[9px]">kg total</span>
          </div>
        </div>
      </div>

      {/* Sub-Gauge: Horizontal Dot-Matrix Calibrated Barcode */}
      <div className="mt-3 pt-2.5 border-t border-[#D4D3CD]">
        <div className="flex items-center justify-between text-[10px] mb-1 text-[#555555] font-sans">
          <span>Turbofan Flow Rate</span>
          <span className="font-bold font-mono text-[#111111]">
            <NumberFlow value={currentFuelBurnRateKgS} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} /> kg/s
          </span>
        </div>

        {/* Barcode / Dot-matrix Segment Meter */}
        <div className="h-2 w-full flex items-center gap-0.5 overflow-hidden rounded-full">
          {Array.from({ length: 36 }).map((_, idx) => {
            const activeThreshold = (idx / 36) * 1.0;
            const isActive = currentFuelBurnRateKgS >= activeThreshold;
            return (
              <div
                key={idx}
                className={`h-full flex-1 transition-colors duration-150 ${
                  isActive ? "bg-[#FF4D00]" : "bg-[#D4D3CD]"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
