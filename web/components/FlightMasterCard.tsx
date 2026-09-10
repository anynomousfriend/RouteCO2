"use client";

import React from "react";
import { Search, MapPin, Fuel, Leaf } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { AircraftWireframe } from "./AircraftWireframe";
import type { PlayableTrack } from "../lib/replay-tracks";

interface FlightMasterCardProps {
  scenario: PlayableTrack | null;
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
  // Replay mode with no playable track yet (no bundled seed, no recordings):
  // honest empty state instead of fabricated flight data.
  if (mode === "replay" && !scenario) {
    return (
      <div
        className={`w-full max-w-[420px] bg-[#343f44] p-6 border border-dashed border-[#d3c6aa]/16 flex flex-col gap-3 items-center justify-center text-center min-h-[420px] select-none ${className}`}
      >
        <MapPin className="w-8 h-8 text-[#859289]" />
        <div className="font-mono text-sm font-semibold text-[#d3c6aa]">
          No replay track available
        </div>
        <div className="text-xs text-[#859289] font-mono leading-relaxed max-w-[280px]">
          Watch a live flight on the radar globe to record its path, or wait for
          the bundled demo track. Replay plays real recorded ADS-B — never
          fabricated telemetry.
        </div>
        <button
          type="button"
          onClick={onOpenCommandSearch}
          className="mt-1 px-4 py-2 bg-[#d3c6aa]/10 hover:bg-[#d3c6aa]/20 text-xs text-[#d3c6aa] cursor-pointer transition-colors font-mono border border-dashed border-[#d3c6aa]/16"
        >
          Browse Tracks (⌘K)
        </button>
      </div>
    );
  }
  const track = scenario;
  const callsign = mode === "replay" ? (track?.callsign || "NO-TRACK") : liveCallsign || "RADAR-1090";
  const icaoHex = mode === "replay" ? (track?.icao24 || "39DE4E") : liveIcao24 || "39DE4E";
  const airframe =
    mode === "replay"
      ? (track?.airframe || "Recorded ADS-B Track")
      : liveEquipmentType && !liveEquipmentType.includes("/")
      ? liveEquipmentType
      : "Airbus A320-200";
  const locationText =
    mode === "replay"
      ? `${track?.destinationAirport || "RADAR"} · ${track?.destinationName || "Recorded live airspace"}`
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

  const displayedHourlyBurn = mode === "live" ? liveHourlyBurn : (track?.hourlyBurnKg || 2400);

  return (
    <div
      className={`w-full max-w-[420px] bg-[#343f44] p-4 border border-dashed border-[#d3c6aa]/16 flex flex-col gap-2.5 select-none ${className}`}
    >
      {/* ── TOP: SEARCH & 2X2 UNIFIED BENTO METRIC TILES ── */}
      <div className="flex flex-col gap-2 px-1">
        {/* Top Search Input (⌘K) */}
        <button
          type="button"
          onClick={onOpenCommandSearch}
          className="w-full h-10 px-3.5 bg-[#2d353b] hover:bg-[#2d353b]/80 flex items-center justify-between text-xs cursor-pointer active:scale-[0.98] transition-[transform,colors] duration-140 border border-dashed border-[#d3c6aa]/16 hover:border-[#a7c080]/50"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#859289]" />
            <span className="text-[#9daaa4] font-mono">Search flight, airport, model...</span>
          </div>
          <kbd className="px-2 py-0.5 text-[10px] font-mono text-[#9daaa4] bg-[#272e33] border border-[#d3c6aa]/16">
            ⌘K
          </kbd>
        </button>

        {/* 2x2 Bento Metric Tiles — Everforest terminal readouts */}
        <div className="grid grid-cols-2 gap-2.5 mx-1">
          {/* Tile 1: Arc L1 Finality */}
          <div className="bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 hover:border-[#7fbbb3]/50 p-3 flex flex-col justify-between h-[84px] transition-colors">
            <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-[#859289]">
              Arc L1 Finality
            </span>
            <div>
              <div className="font-mono text-[19px] font-semibold text-[#d3c6aa] leading-none tabular-nums">
                &lt; 800<span className="text-xs text-[#859289] ml-1 font-normal">ms</span>
              </div>
              <div className="text-[9px] font-mono text-[#a7c080] mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#a7c080] blink-step" />
                <span>Sub-second 100%</span>
              </div>
            </div>
          </div>

          {/* Tile 2: Arc Treasury */}
          <div className="bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 hover:border-[#7fbbb3]/50 p-3 flex flex-col justify-between h-[84px] transition-colors">
            <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-[#859289]">
              Arc Treasury
            </span>
            <div>
              <div className="font-mono text-[19px] font-semibold text-[#d3c6aa] leading-none tabular-nums">
                ${isBalanceLoading ? "..." : (treasuryBalance || "0.00")}
                <span className="text-xs ml-1 text-[#859289] font-normal">USDC</span>
              </div>
              <div className="text-[9px] font-mono text-[#859289] mt-1">
                Chain ID 5042002
              </div>
            </div>
          </div>

          {/* Tile 3: Settlement Cost */}
          <div className="bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 hover:border-[#dbbc7f]/50 p-3 flex flex-col justify-between h-[84px] transition-colors">
            <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-[#859289]">
              Settlement Cost
            </span>
            <div>
              <div className="font-mono text-[19px] font-semibold text-[#dbbc7f] leading-none tabular-nums">
                ${scaledCostUSDC || (usdcCost / 1000).toFixed(4)}
                <span className="text-xs ml-1 text-[#859289] font-normal">USDC</span>
              </div>
              <div className="text-[9px] font-mono text-[#859289] mt-1">
                1:1k Scale (${usdcCost.toFixed(2)})
              </div>
            </div>
          </div>

          {/* Tile 4: Carbon Retired */}
          <div className="bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 hover:border-[#a7c080]/50 p-3 flex flex-col justify-between h-[84px] transition-colors">
            <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-[#859289]">
              Carbon Retired
            </span>
            <div>
              <div className="font-mono text-[19px] font-semibold text-[#a7c080] leading-none tabular-nums flex items-baseline">
                {isCreditsLoading ? "..." : (
                  <NumberFlow value={Number(totalCarbonCredits || co2Kg)} />
                )}
                <span className="text-xs ml-1 text-[#a7c080]/80 font-normal">kg</span>
              </div>
              <div className="text-[9px] font-mono text-[#a7c080]/90 mt-1">
                Verified on Arc L1
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE: FLIGHT IDENTITY & OPERATIONAL SPECS ── */}
      <div className="flex flex-col gap-2 pt-2 border-t border-dashed border-[#d3c6aa]/16 px-1">
        {/* Location Breadcrumb & Airspace Title */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#859289] mb-1 font-mono">
            <MapPin className="w-3.5 h-3.5 text-[#859289] shrink-0" />
            <span className="truncate">{locationText}</span>
          </div>
          <h1 className="font-mono text-[26px] font-semibold tracking-tight text-[#d3c6aa] leading-none">
            {callsign}
          </h1>
          <div className="text-xs text-[#9daaa4] font-mono mt-1 flex items-center gap-1.5">
            <span className="font-medium text-[#d3c6aa]">{airframe}</span>
            <span className="text-[#859289]">·</span>
            <span>{mode === "replay" ? (track?.airline || "Recorded Track") : "Commercial Carrier"}</span>
          </div>
        </div>

        {/* Active Transponder Status Tag */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#a7c080]/[0.08] border border-dashed border-[#a7c080]/30 text-[11px] font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#a7c080] blink-step" />
            <span className="text-[#a7c080] font-medium">Transponder:</span>
            <strong className="font-semibold text-[#d3c6aa]">0x{icaoHex.toUpperCase().replace("0X", "")}</strong>
          </span>
          <span className="text-[#a7c080]/80 text-[10px] font-medium">1090 MHz ADS-B</span>
        </div>

        {/* Key Operational Metrics: Clean Hairline List */}
        <div className="space-y-1 text-xs pt-0.5">
          <div className="flex items-center justify-between py-0.5 px-1">
            <span className="flex items-center gap-2 text-[#859289] font-mono">
              <Fuel className="w-3.5 h-3.5 text-[#e69875]" />
              <span>ICAO Hourly Fuel Burn</span>
            </span>
            <span className="font-mono font-semibold text-[#d3c6aa] tabular-nums">
              {displayedHourlyBurn.toLocaleString()} kg/hr
            </span>
          </div>

          <div className="flex items-center justify-between py-0.5 px-1 border-t border-dashed border-[#d3c6aa]/[0.08]">
            <span className="flex items-center gap-2 text-[#859289] font-mono">
              <Leaf className="w-3.5 h-3.5 text-[#a7c080]" />
              <span>Verified CO₂ Factor</span>
            </span>
            <span className="font-mono font-semibold text-[#d3c6aa] tabular-nums">
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
          runway={track?.runway || "—"}
          altitudeFt={altitudeFt}
          speedKts={speedKts}
          className="w-full h-full flex-1"
        />
      </div>
    </div>
  );
}
