"use client";

import React from "react";
import { Search, MapPin, Fuel, Leaf, Radio, Zap } from "lucide-react";
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
  // 2D watch/arm wiring (live mode): record path or auto-settle on touchdown.
  isWatched?: boolean;
  isArmed?: boolean;
  watchFixCount?: number;
  onToggleWatch?: (callsign: string) => void;
  onToggleArm?: (callsign: string) => void;
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
  isWatched = false,
  isArmed = false,
  watchFixCount = 0,
  onToggleWatch,
  onToggleArm,
}: FlightMasterCardProps) {
  // Replay mode with no playable track yet (no bundled seed, no recordings):
  // honest empty state instead of fabricated flight data.
  if (mode === "replay" && !scenario) {
    return (
      <div
        className={`w-full max-w-[420px] bg-[#D6D5CF] p-6 rounded-xl border border-[#D4D3CD] flex flex-col gap-3 items-center justify-center text-center min-h-[420px] select-none ${className}`}
      >
        <div className="icon-circle w-10 h-10">
          <MapPin className="w-5 h-5 text-[#111111]" />
        </div>
        <div className="font-sans text-sm font-bold text-[#111111]">
          No replay track available
        </div>
        <div className="text-xs text-[#555555] font-sans leading-relaxed max-w-[280px]">
          Watch a live flight on the 2D radar to record its path, or wait for
          the bundled demo track. Replay plays real recorded ADS-B: never
          fabricated telemetry.
        </div>
        <button
          type="button"
          onClick={onOpenCommandSearch}
          className="btn-pill mt-2 px-5 py-2 bg-[#111111] hover:bg-[#FF4D00] text-xs font-semibold text-[#ECEBE6] cursor-pointer transition-colors font-sans shadow-sm"
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
      className={`w-full max-w-[420px] bg-[#D6D5CF] p-4 rounded-xl border border-[#D4D3CD] flex flex-col gap-2.5 select-none ${className}`}
    >
      {/* ── TOP: SEARCH & 2X2 UNIFIED BENTO METRIC TILES ── */}
      <div className="flex flex-col gap-2 px-1">
        {/* Top Search Input (⌘K): Stadium Pill */}
        <button
          type="button"
          onClick={onOpenCommandSearch}
          className="btn-pill w-full h-10 px-4 bg-[#ECEBE6] hover:bg-[#ECEBE6]/80 flex items-center justify-between text-xs cursor-pointer transition-colors border border-[#D4D3CD] hover:border-[#111111]"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#555555]" />
            <span className="text-[#555555] font-sans">Search flight, airport, model...</span>
          </div>
          <kbd className="px-2 py-0.5 text-[10px] font-mono text-[#555555] bg-[#D6D5CF] rounded-md border border-[#D4D3CD]">
            ⌘K
          </kbd>
        </button>

        {/* 2x2 Bento Metric Tiles: Minimalist Architectural Readouts */}
        <div className="grid grid-cols-2 gap-2.5 mx-0.5">
          {/* Tile 1: Arc L1 Finality */}
          <div className="bg-[#ECEBE6] border border-[#D4D3CD] rounded-lg p-3 flex flex-col justify-between h-[84px] transition-colors hover:border-[#111111]">
            <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-[#555555]">
              Arc L1 Finality
            </span>
            <div>
              <div className="font-mono text-[19px] font-semibold text-[#111111] leading-none tabular-nums">
                &lt; 800<span className="text-xs text-[#555555] ml-1 font-normal">ms</span>
              </div>
              <div className="text-[9px] font-mono text-[#111111] mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#FF4D00] blink-step rounded-full" />
                <span>Sub-second 100%</span>
              </div>
            </div>
          </div>

          {/* Tile 2: Arc Treasury */}
          <div className="bg-[#ECEBE6] border border-[#D4D3CD] rounded-lg p-3 flex flex-col justify-between h-[84px] transition-colors hover:border-[#111111]">
            <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-[#555555]">
              Arc Treasury
            </span>
            <div>
              <div className="font-mono text-[19px] font-semibold text-[#111111] leading-none tabular-nums">
                ${isBalanceLoading ? "..." : (treasuryBalance || "0.00")}
                <span className="text-xs ml-1 text-[#555555] font-normal">USDC</span>
              </div>
              <div className="text-[9px] font-mono text-[#555555] mt-1">
                Chain ID 5042002
              </div>
            </div>
          </div>

          {/* Tile 3: Settlement Cost */}
          <div className="bg-[#ECEBE6] border border-[#D4D3CD] rounded-lg p-3 flex flex-col justify-between h-[84px] transition-colors hover:border-[#111111]">
            <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-[#555555]">
              Settlement Cost
            </span>
            <div>
              <div className="font-mono text-[19px] font-semibold text-[#111111] leading-none tabular-nums">
                ${scaledCostUSDC || (usdcCost / 1000).toFixed(4)}
                <span className="text-xs ml-1 text-[#555555] font-normal">USDC</span>
              </div>
              <div className="text-[9px] font-mono text-[#555555] mt-1">
                1:1k Scale (${usdcCost.toFixed(2)})
              </div>
            </div>
          </div>

          {/* Tile 4: Carbon Retired */}
          <div className="bg-[#ECEBE6] border border-[#D4D3CD] rounded-lg p-3 flex flex-col justify-between h-[84px] transition-colors hover:border-[#111111]">
            <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-[#555555]">
              Carbon Retired
            </span>
            <div>
              <div className="font-mono text-[19px] font-semibold text-[#111111] leading-none tabular-nums flex items-baseline">
                {isCreditsLoading ? "..." : (
                  <NumberFlow value={Number(totalCarbonCredits || co2Kg)} />
                )}
                <span className="text-xs ml-1 text-[#555555] font-normal">kg</span>
              </div>
              <div className="text-[9px] font-mono text-[#555555] mt-1">
                Verified on Arc L1
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE: FLIGHT IDENTITY & OPERATIONAL SPECS ── */}
      <div className="flex flex-col gap-2 pt-2 border-t border-[#D4D3CD] px-1">
        {/* Location Breadcrumb & Airspace Title */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#555555] mb-1 font-sans">
            <MapPin className="w-3.5 h-3.5 text-[#555555] shrink-0" />
            <span className="truncate">{locationText}</span>
          </div>
          <h1 className="font-sans text-[28px] font-bold tracking-tight text-[#111111] leading-none">
            {callsign}
          </h1>
          <div className="text-xs text-[#555555] font-sans mt-1.5 flex items-center gap-1.5">
            <span className="font-medium text-[#111111]">{airframe}</span>
            <span className="text-[#888888]">·</span>
            <span>{mode === "replay" ? (track?.airline || "Recorded Track") : "Commercial Carrier"}</span>
          </div>
        </div>

        {/* Active Transponder Status Tag */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#ECEBE6] border border-[#D4D3CD] rounded-full text-[11px] font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#FF4D00] blink-step rounded-full" />
            <span className="text-[#555555] font-medium">Transponder:</span>
            <strong className="font-semibold text-[#111111]">0x{icaoHex.toUpperCase().replace("0X", "")}</strong>
          </span>
          <span className="text-[#555555] text-[10px] font-medium">1090 MHz ADS-B</span>
        </div>

        {/* Watch / Arm Actions (live 2D radar only) */}
        {mode === "live" && liveCallsign && onToggleWatch && onToggleArm && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleWatch(liveCallsign)}
              title={
                isWatched
                  ? "Stop recording this flight's path"
                  : "Record this flight's path: replay it after landing, then settle manually"
              }
              className={`btn-pill flex-1 flex items-center justify-center gap-2 py-2 px-3 font-mono text-xs font-semibold transition-[transform,opacity,background-color] duration-140 active:scale-[0.98] border cursor-pointer ${
                isWatched
                  ? "bg-[#FF4D00]/15 border-[#FF4D00] text-[#FF4D00]"
                  : "bg-[#ECEBE6] border-[#D4D3CD] text-[#111111] hover:border-[#FF4D00]"
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isWatched ? "animate-pulse" : ""}`} />
              <span>{isWatched ? `Watching · ${watchFixCount} fixes` : "Watch Flight"}</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleArm(liveCallsign)}
              title={
                isArmed
                  ? "Disarm automatic touchdown settlement"
                  : "Arm automatic carbon-offset settlement on touchdown"
              }
              className={`btn-pill flex-1 flex items-center justify-center gap-2 py-2 px-3 font-mono text-xs font-semibold transition-[transform,opacity,background-color] duration-140 active:scale-[0.98] border cursor-pointer ${
                isArmed
                  ? "bg-[#111111] border-[#111111] text-[#ECEBE6] hover:bg-[#FF4D00] hover:border-[#FF4D00]"
                  : "bg-[#FF4D00] border-[#FF4D00] text-[#ECEBE6] hover:bg-[#FF4D00]/90"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isArmed ? "Armed · Auto-Settle" : "Arm Auto-Settle"}</span>
            </button>
          </div>
        )}

        {/* Key Operational Metrics: Clean Hairline List */}
        <div className="space-y-1 text-xs pt-0.5">
          <div className="flex items-center justify-between py-1 px-1">
            <span className="flex items-center gap-2 text-[#555555] font-sans">
              <Fuel className="w-3.5 h-3.5 text-[#111111]" />
              <span>ICAO Hourly Fuel Burn</span>
            </span>
            <span className="font-mono font-semibold text-[#111111] tabular-nums">
              {displayedHourlyBurn.toLocaleString()} kg/hr
            </span>
          </div>

          <div className="flex items-center justify-between py-1 px-1 border-t border-[#D4D3CD]">
            <span className="flex items-center gap-2 text-[#555555] font-sans">
              <Leaf className="w-3.5 h-3.5 text-[#111111]" />
              <span>Verified CO₂ Factor</span>
            </span>
            <span className="font-mono font-semibold text-[#111111] tabular-nums">
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
          runway={track?.runway || "--"}
          altitudeFt={altitudeFt}
          speedKts={speedKts}
          className="w-full h-full flex-1"
        />
      </div>
    </div>
  );
}
