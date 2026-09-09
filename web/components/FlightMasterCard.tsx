"use client";

import React from "react";
import { Search, MapPin, Fuel, Leaf } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { AircraftWireframe } from "./AircraftWireframe";
import type { ReplayScenario } from "../lib/replay-scenarios";

interface FlightMasterCardProps {
  scenario: ReplayScenario;
  liveCallsign?: string;
  liveOriginCountry?: string;
  liveIcao24?: string;
  liveEquipmentType?: string;
  mode: "replay" | "live";
  altitudeM: number;
  velocityMps: number;
  fuelBurnKg: number;
  co2Kg: number;
  usdcCost: number;
  scaledCostUSDC: string;
  treasuryBalance: string | null;
  isBalanceLoading: boolean;
  totalCarbonCredits: string | null;
  isCreditsLoading: boolean;
  onOpenCommandSearch: () => void;
  className?: string;
}

export function FlightMasterCard({
  scenario,
  liveCallsign,
  liveOriginCountry,
  liveIcao24,
  liveEquipmentType,
  mode,
  altitudeM,
  velocityMps,
  fuelBurnKg,
  co2Kg,
  usdcCost,
  scaledCostUSDC,
  treasuryBalance,
  isBalanceLoading,
  totalCarbonCredits,
  isCreditsLoading,
  onOpenCommandSearch,
  className = "",
}: FlightMasterCardProps) {
  const callsign = mode === "replay" ? scenario.callsign : liveCallsign || "RADAR-1090";
  const icaoHex = mode === "replay" ? scenario.icao24 : liveIcao24 || "39DE4E";
  const airframe =
    mode === "replay"
      ? scenario.airframe
      : liveEquipmentType && !liveEquipmentType.includes("/")
      ? liveEquipmentType
      : "Airbus A320-200";
  const locationText =
    mode === "replay"
      ? `${scenario.destinationAirport} · ${scenario.destinationName}`
      : `${liveOriginCountry || "International Airspace"} Sector`;

  const altitudeFt = Math.round(altitudeM * 3.28084);
  const speedKts = Math.round(velocityMps * 1.94384);

  const liveCategory = React.useMemo(() => {
    const equip = (liveEquipmentType || "").toUpperCase();
    if (
      equip.includes("A380") ||
      equip.includes("B747") ||
      equip.includes("A340") ||
      equip.includes("B77W")
    )
      return "HEAVY";
    if (
      equip.includes("A350") ||
      equip.includes("B777") ||
      equip.includes("B787") ||
      equip.includes("A330") ||
      equip.includes("A339")
    )
      return "WIDE_BODY";
    if (
      equip.includes("E190") ||
      equip.includes("E195") ||
      equip.includes("CRJ") ||
      equip.includes("AT7") ||
      equip.includes("DH8")
    )
      return "REGIONAL";
    return "NARROW_BODY";
  }, [liveEquipmentType]);

  const liveHourlyBurn = React.useMemo(() => {
    switch (liveCategory) {
      case "HEAVY":
        return 10200;
      case "WIDE_BODY":
        return 6500;
      case "REGIONAL":
        return 1600;
      case "NARROW_BODY":
      default:
        return 2400;
    }
  }, [liveCategory]);

  const displayedHourlyBurn = mode === "live" ? liveHourlyBurn : scenario.hourlyBurnKg;

  return (
    <div
      className={`w-full max-w-[420px] bg-white rounded-3xl p-4 border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col gap-2.5 select-none ${className}`}
    >
      {/* ── TOP: SEARCH & 2X2 UNIFIED BENTO METRIC TILES ── */}
      <div className="flex flex-col gap-2 px-1">
        {/* Top Search Input (⌘K) */}
        <button
          type="button"
          onClick={onOpenCommandSearch}
          className="w-full h-10 px-3.5 bg-neutral-100/80 hover:bg-neutral-100 rounded-xl border border-black/[0.06] flex items-center justify-between text-xs text-neutral-400 cursor-pointer active:scale-[0.98] transition-[transform,colors] duration-140"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-500 font-sans">Search flight, airport, model...</span>
          </div>
          <kbd className="px-2 py-0.5 text-[10px] font-mono text-neutral-500 bg-white rounded border border-black/[0.08] shadow-2xs">
            ⌘K
          </kbd>
        </button>

        {/* 2x2 Bento Metric Tiles (Unified Cockpit Slate Palette with left & right margin) */}
        <div className="grid grid-cols-2 gap-2.5 mx-1">
          {/* Tile 1: Arc L1 Finality */}
          <div className="bg-[#0C111D] text-white border border-white/10 rounded-2xl p-3 flex flex-col justify-between h-[84px] shadow-sm hover:border-white/20 transition-colors">
            <span className="text-[9.5px] font-mono uppercase tracking-wider text-neutral-400">
              Arc L1 Finality
            </span>
            <div>
              <div className="font-mono text-[19px] font-bold text-white leading-none tabular-nums">
                &lt; 800<span className="text-xs font-sans text-neutral-400 ml-1 font-normal">ms</span>
              </div>
              <div className="text-[9px] font-mono text-emerald-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Sub-second 100%</span>
              </div>
            </div>
          </div>

          {/* Tile 2: Arc Treasury */}
          <div className="bg-[#0C111D] text-white border border-white/10 rounded-2xl p-3 flex flex-col justify-between h-[84px] shadow-sm hover:border-white/20 transition-colors">
            <span className="text-[9.5px] font-mono uppercase tracking-wider text-neutral-400">
              Arc Treasury
            </span>
            <div>
              <div className="font-mono text-[19px] font-bold text-white leading-none tabular-nums">
                ${isBalanceLoading ? "..." : (treasuryBalance || "0.00")}
                <span className="text-xs font-sans ml-1 text-neutral-400 font-normal">USDC</span>
              </div>
              <div className="text-[9px] font-mono text-neutral-400 mt-1">
                Chain ID 5042002
              </div>
            </div>
          </div>

          {/* Tile 3: Settlement Cost */}
          <div className="bg-[#0C111D] text-white border border-white/10 rounded-2xl p-3 flex flex-col justify-between h-[84px] shadow-sm hover:border-white/20 transition-colors">
            <span className="text-[9.5px] font-mono uppercase tracking-wider text-neutral-400">
              Settlement Cost
            </span>
            <div>
              <div className="font-mono text-[19px] font-bold text-white leading-none tabular-nums">
                ${scaledCostUSDC || (usdcCost / 1000).toFixed(4)}
                <span className="text-xs font-sans text-neutral-400 ml-1 font-normal">USDC</span>
              </div>
              <div className="text-[9px] font-mono text-neutral-400 mt-1">
                1:1k Scale (${usdcCost.toFixed(2)})
              </div>
            </div>
          </div>

          {/* Tile 4: Carbon Retired */}
          <div className="bg-[#0C111D] text-white border border-white/10 rounded-2xl p-3 flex flex-col justify-between h-[84px] shadow-sm hover:border-white/20 transition-colors">
            <span className="text-[9.5px] font-mono uppercase tracking-wider text-neutral-400">
              Carbon Retired
            </span>
            <div>
              <div className="font-mono text-[19px] font-bold text-emerald-400 leading-none tabular-nums flex items-baseline">
                {isCreditsLoading ? "..." : (
                  <NumberFlow value={Number(totalCarbonCredits || co2Kg)} />
                )}
                <span className="text-xs font-sans ml-1 text-emerald-400/80 font-normal">kg</span>
              </div>
              <div className="text-[9px] font-mono text-emerald-400/90 mt-1">
                Verified on Arc L1
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE: FLIGHT IDENTITY & OPERATIONAL SPECS ── */}
      <div className="flex flex-col gap-2 pt-2 border-t border-black/[0.08] px-1">
        {/* Location Breadcrumb & Airspace Title */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 mb-1">
            <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="truncate">{locationText}</span>
          </div>
          <h1 className="font-mono text-[26px] font-bold tracking-tight text-neutral-950 leading-none">
            {callsign}
          </h1>
          <div className="text-xs text-neutral-500 font-sans mt-1 flex items-center gap-1.5">
            <span className="font-medium text-neutral-700">{airframe}</span>
            <span className="text-neutral-300">·</span>
            <span>{mode === "replay" ? scenario.airline : "Commercial Carrier"}</span>
          </div>
        </div>

        {/* Active Transponder Status Tag */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 text-[11px] font-mono text-emerald-950">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-800 font-medium">Transponder:</span>
            <strong className="font-bold text-emerald-950">0x{icaoHex.toUpperCase().replace("0X", "")}</strong>
          </span>
          <span className="text-emerald-700 text-[10px] font-medium">1090 MHz ADS-B</span>
        </div>

        {/* Key Operational Metrics: Clean Hairline List */}
        <div className="space-y-1 text-xs pt-0.5">
          <div className="flex items-center justify-between py-0.5 px-1">
            <span className="flex items-center gap-2 text-neutral-500 font-sans">
              <Fuel className="w-3.5 h-3.5 text-neutral-400" />
              <span>ICAO Hourly Fuel Burn</span>
            </span>
            <span className="font-mono font-semibold text-neutral-900 tabular-nums">
              {displayedHourlyBurn.toLocaleString()} kg/hr
            </span>
          </div>

          <div className="flex items-center justify-between py-0.5 px-1 border-t border-black/[0.04]">
            <span className="flex items-center gap-2 text-neutral-500 font-sans">
              <Leaf className="w-3.5 h-3.5 text-neutral-400" />
              <span>Verified CO₂ Factor</span>
            </span>
            <span className="font-mono font-semibold text-neutral-900 tabular-nums">
              3.16 CORSIA Standard
            </span>
          </div>
        </div>
      </div>

      {/* ── BOTTOM: AIRCRAFT CAD WIREFRAME SCHEMATIC (Responsive flex-1 to fill height) ── */}
      <div className="flex-1 flex flex-col min-h-[190px] pt-0 px-0">
        <AircraftWireframe
          callsign={callsign}
          airframe={airframe}
          icao24={icaoHex}
          hourlyBurnKg={displayedHourlyBurn}
          runway={scenario.runway}
          altitudeFt={altitudeFt}
          speedKts={speedKts}
          className="w-full h-full flex-1"
        />
      </div>
    </div>
  );
}
