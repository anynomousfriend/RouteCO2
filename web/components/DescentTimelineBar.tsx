"use client";

import React from "react";
import {
  Play,
  Pause,
  SkipForward,
  CheckCircle2,
  ExternalLink,
  Radio,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

interface DescentTimelineBarProps {
  replayIndex: number;
  totalFrames: number;
  isPlaying: boolean;
  isLanded: boolean;
  isSettled: boolean;
  isSettling: boolean;
  currentAltitudeM: number;
  mode: "replay" | "live";
  onTogglePlay: () => void;
  onStepNext: () => void;
  onJumpToTouchdown: () => void;
  onTriggerSettlement: () => void;
  onOpenCertificate: () => void;
  onScrub: (index: number) => void;
  className?: string;
  // Live flight avionics telemetry props
  liveCallsign?: string;
  liveOriginCountry?: string;
  liveIcao24?: string;
  liveEquipmentType?: string;
  liveVelocityMps?: number;
  liveVerticalRateMps?: number;
  usdcCost?: number;
  settlementTxHash?: string;
}

export function DescentTimelineBar({
  replayIndex,
  totalFrames,
  isPlaying,
  isLanded,
  isSettled,
  isSettling,
  currentAltitudeM,
  mode,
  onTogglePlay,
  onStepNext,
  onJumpToTouchdown,
  onTriggerSettlement,
  onOpenCertificate,
  onScrub,
  className = "",
  liveCallsign,
  liveOriginCountry,
  liveIcao24,
  liveEquipmentType,
  liveVelocityMps = 0,
  liveVerticalRateMps = 0,
  usdcCost = 5.0,
  settlementTxHash,
}: DescentTimelineBarProps) {
  const currentAltFt = Math.round(currentAltitudeM * 3.28084);
  const currentFlightLevel = Math.round(currentAltFt / 100);
  const progressPercent = totalFrames > 1 ? (replayIndex / (totalFrames - 1)) * 100 : 0;
  const speedKts = Math.round(liveVelocityMps * 1.94384);
  const vrateFpm = Math.round(liveVerticalRateMps * 196.85);

  return (
    <div
      className={`h-14 bg-[#0A0E1A]/85 backdrop-blur-xl rounded-2xl border border-white/10 text-white shadow-2xl px-4 flex items-center justify-between gap-4 select-none z-20 transition-colors ${className}`}
    >
      {/* ── LEFT: MODE IDENTITY & PLAYBACK CONTROLS ── */}
      {mode === "replay" ? (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause Descent Replay" : "Play Descent Replay"}
            className="w-8 h-8 rounded-xl bg-white text-black hover:bg-neutral-200 flex items-center justify-center active:scale-[0.92] transition-transform duration-140 cursor-pointer shadow-xs"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onStepNext}
            title="Step Next Telemetry Frame"
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-[0.92] transition-transform duration-140 cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onJumpToTouchdown}
            title="Jump Directly to Wheels-Down"
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-medium flex items-center gap-1 active:scale-[0.96] transition-[transform,colors] duration-140 cursor-pointer ${
              isSettled
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-white/10 hover:bg-white/20 text-neutral-200"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Touchdown</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute opacity-75" />
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm tracking-wide text-white">
                {liveCallsign || "ACQUIRING..."}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LIVE ADS-B
              </span>
            </div>
            <span className="text-[10px] text-neutral-400 truncate max-w-[130px]">
              {liveOriginCountry || "OpenSky Network"} · {liveEquipmentType || "A320"}
            </span>
          </div>
        </div>
      )}

      {/* ── CENTER: MODE-ADAPTIVE TELEMETRY HUD ── */}
      {mode === "replay" ? (
        /* Replay Mode: Calibrated Glidepath Descent Ruler */
        <div className="flex-1 max-w-xl flex flex-col justify-center px-2">
          {/* Scale Numbers Header */}
          <div className="flex justify-between text-[9.5px] font-mono text-neutral-400 mb-1 px-1">
            <span>FL360</span>
            <span>FL240</span>
            <span>FL100</span>
            <span>3,000 FT</span>
            <span className="text-emerald-400 font-bold">0 FT (TOUCHDOWN)</span>
          </div>

          {/* Calibrated Track with Ticks and Scrubber */}
          <div className="relative h-2 bg-white/10 rounded-full overflow-visible flex items-center">
            {/* Tick marks */}
            <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
              <span className="w-[1px] h-2 bg-white/20" />
              <span className="w-[1px] h-2 bg-white/20" />
              <span className="w-[1px] h-2 bg-white/20" />
              <span className="w-[1px] h-2 bg-white/20" />
              <span className="w-[1px] h-2 bg-emerald-400" />
            </div>

            {/* Active Fill Line */}
            <div
              style={{ width: `${progressPercent}%` }}
              className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-emerald-300 rounded-full transition-[width] duration-100 ease-out"
            />

            {/* Interactive Scrub Range Input */}
            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              value={replayIndex}
              onChange={(e) => onScrub(Number(e.target.value))}
              aria-label="Descent playback scrubber"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />

            {/* Scrub Indicator Pin with Live Altitude Tooltip */}
            <div
              style={{ left: `calc(${progressPercent}% - 7px)` }}
              className="absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-400 shadow-md pointer-events-none transition-[left] duration-100 ease-out flex items-center justify-center"
            >
              <div className="absolute -top-7 px-1.5 py-0.5 rounded bg-black/90 border border-white/20 text-[9px] font-mono text-emerald-400 whitespace-nowrap shadow-lg">
                {currentAltFt.toLocaleString()} ft
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Live Mode: Real-Time Avionics Telemetry Ticker */
        <div className="flex-1 max-w-xl flex items-center justify-center gap-6 px-2 text-xs font-mono">
          {/* Metric 1: Barometric Altitude */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-400 uppercase">ALT</span>
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-white tabular-nums">
                {currentAltFt.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold">
                FL{currentFlightLevel}
              </span>
            </div>
          </div>

          <div className="w-[1px] h-4 bg-white/10" />

          {/* Metric 2: Ground Speed */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-400 uppercase">GS</span>
            <span className="font-bold text-white tabular-nums">
              {speedKts} <span className="text-[10px] text-neutral-400 font-normal">KTS</span>
            </span>
          </div>

          <div className="w-[1px] h-4 bg-white/10" />

          {/* Metric 3: Vertical Climb / Descent Rate */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-400 uppercase">VSI</span>
            <div className="flex items-center gap-1">
              {vrateFpm > 100 ? (
                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              ) : vrateFpm < -100 ? (
                <ArrowDownRight className="w-3 h-3 text-amber-400" />
              ) : (
                <Minus className="w-3 h-3 text-neutral-400" />
              )}
              <span
                className={`font-bold tabular-nums ${
                  vrateFpm > 100
                    ? "text-emerald-400"
                    : vrateFpm < -100
                    ? "text-amber-400"
                    : "text-neutral-300"
                }`}
              >
                {vrateFpm > 0 ? `+${vrateFpm}` : vrateFpm}
              </span>
              <span className="text-[9px] text-neutral-400">FPM</span>
            </div>
          </div>

          <div className="w-[1px] h-4 bg-white/10 hidden md:block" />

          {/* Metric 4: Transponder Hex */}
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-400 uppercase">XPNDR</span>
            <span className="px-1.5 py-0.5 rounded bg-white/10 font-bold text-[10.5px] text-cyan-300">
              0x{(liveIcao24 || "39DE4B").toUpperCase().replace("0X", "")}
            </span>
          </div>
        </div>
      )}

      {/* ── RIGHT: SETTLEMENT TRIGGER BUTTON ── */}
      <div className="relative group flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={isSettled ? onOpenCertificate : onTriggerSettlement}
          disabled={isSettling}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl active:scale-[0.96] transition-[transform,colors] duration-140 cursor-pointer shadow-lg ${
            isSettled
              ? "bg-emerald-500 text-black font-bold hover:bg-emerald-400"
              : isSettling
              ? "bg-[#7C4DFF] text-white opacity-80 animate-pulse cursor-wait"
              : "bg-white text-black hover:bg-neutral-100"
          }`}
        >
          {isSettled ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-black" />
              <span>Settled on Arc</span>
              {settlementTxHash && (
                <a
                  href={`https://testnet.arcscan.app/tx/${settlementTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-black/70 hover:text-black ml-0.5 p-0.5 rounded hover:bg-black/10 transition-colors"
                  title="Open Transaction on ArcScan Explorer"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </>
          ) : isSettling ? (
            <span>Settling on Arc...</span>
          ) : mode === "live" ? (
            <span>Settle Leg · ${usdcCost.toFixed(2)} USDC</span>
          ) : (
            <span>Settle Wheels-Down · ${usdcCost.toFixed(2)} USDC</span>
          )}
        </button>

        {/* Informative Hover Popover Explaining What This Button Does */}
        <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col w-72 p-3 rounded-2xl bg-[#0F1422] border border-white/10 text-white shadow-2xl z-50 pointer-events-none text-left animate-in fade-in zoom-in-95 duration-140">
          <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 font-bold mb-1">
            <span>ARC SETTLEMENT TRIGGER</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">1INCH AQUA</span>
          </div>
          <p className="text-[11px] text-neutral-300 leading-snug">
            {mode === "live"
              ? `Executes on-chain retirement of ${((usdcCost / 25) * 1000).toFixed(0)} kg CO₂ for this flight segment using native USDC via SkyRouteVault on Arc Testnet.`
              : "Executes atomic zero-custody wheels-down carbon offset retirement upon touchdown using native Arc USDC."}
          </p>
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[9.5px] font-mono text-neutral-400">
            <span>CHAIN ID: 5042002</span>
            <span className="text-emerald-400">ZERO-ESCROW PULL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
