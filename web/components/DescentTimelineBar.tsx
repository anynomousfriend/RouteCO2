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
  playbackSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  trackSource?: string;
  trackLabel?: string;
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
  playbackSpeed = 1,
  onSpeedChange,
  trackSource,
  trackLabel,
}: DescentTimelineBarProps) {
  const currentAltFt = Math.round(currentAltitudeM * 3.28084);
  const currentFlightLevel = Math.round(currentAltFt / 100);
  const progressPercent = totalFrames > 1 ? (replayIndex / (totalFrames - 1)) * 100 : 0;
  const speedKts = Math.round(liveVelocityMps * 1.94384);
  const vrateFpm = Math.round(liveVerticalRateMps * 196.85);

  // Two-step real-spend confirm for settlements >= $5 (first click arms, second broadcasts).
  const [confirmArmed, setConfirmArmed] = React.useState(false);
  const confirmTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);
  React.useEffect(() => {
    setConfirmArmed(false);
  }, [isSettled, liveCallsign, replayIndex === 0]);
  const needsConfirm = usdcCost >= 5 && !isSettled && !isSettling;
  const handleTriggerClick = () => {
    if (isSettled) {
      onOpenCertificate();
      return;
    }
    if (needsConfirm && !confirmArmed) {
      setConfirmArmed(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmArmed(false), 8000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmArmed(false);
    onTriggerSettlement();
  };

  return (
    <div
      className={`h-14 bg-[#D6D5CF]/95 backdrop-blur-md rounded-xl border border-[#D4D3CD] text-[#111111] px-4 flex items-center justify-between gap-4 select-none z-20 transition-colors shadow-xs ${className}`}
    >
      {/* ── LEFT: MODE IDENTITY & PLAYBACK CONTROLS ── */}
      {mode === "replay" ? (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause Track Replay" : "Play Track Replay"}
            className="w-8 h-8 rounded-full bg-[#111111] text-[#ECEBE6] hover:bg-[#FF4D00] flex items-center justify-center active:scale-[0.97] transition-[transform,colors] duration-140 cursor-pointer shadow-xs"
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
            className="w-8 h-8 rounded-full bg-[#ECEBE6] hover:bg-[#ECEBE6]/80 text-[#111111] border border-[#D4D3CD] flex items-center justify-center active:scale-[0.97] transition-[transform,colors] duration-140 cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onJumpToTouchdown}
            title="Jump Directly to Wheels-Down"
            className={`btn-pill px-3 py-1.5 text-[11px] font-mono font-medium flex items-center gap-1.5 active:scale-[0.97] transition-[transform,colors] duration-140 cursor-pointer border ${
              isSettled
                ? "bg-[#ECEBE6] text-[#111111] border-[#D4D3CD]"
                : "bg-[#ECEBE6] hover:bg-[#ECEBE6]/80 text-[#555555] border-[#D4D3CD]"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#FF4D00]" />
            <span>Touchdown</span>
          </button>
          {/* Playback speed (demo-friendly fast-forward of recorded fixes) */}
          {onSpeedChange && (
            <div
              className="flex items-center rounded-full overflow-hidden border border-[#D4D3CD] bg-[#ECEBE6]"
              title="Replay speed: recorded fixes play back faster for demos"
            >
              {[1, 2, 4, 8].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSpeedChange(s)}
                  className={`px-2 py-0.5 text-[9.5px] font-mono font-bold transition-colors cursor-pointer ${
                    playbackSpeed === s
                      ? "bg-[#111111] text-[#ECEBE6]"
                      : "text-[#555555] hover:text-[#111111]"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
          {trackSource && trackSource !== "synthetic" && (
            <span
              title={trackLabel ? `Replaying ${trackLabel}: real recorded ADS-B fixes` : "Replaying real recorded ADS-B fixes"}
              className="px-2 py-1.5 text-[9px] font-mono font-bold bg-[#7fbbb3]/15 text-[#7fbbb3] border border-dashed border-[#7fbbb3]/40"
            >
              RECORDED
            </span>
          )}
          {trackSource === "synthetic" && (
            <span
              title="Physics fixture for development: not real telemetry"
              className="px-2 py-1.5 text-[9px] font-mono font-bold bg-[#dbbc7f]/15 text-[#dbbc7f] border border-dashed border-[#dbbc7f]/40"
            >
              SYNTHETIC
            </span>
          )}
        </div>
      ) : (
        /* Live Mode Header Indicator */
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ECEBE6] border border-[#D4D3CD] rounded-full">
            <Radio className="w-3.5 h-3.5 text-[#FF4D00] blink-step" />
            <span className="font-mono text-xs font-bold text-[#111111]">
              {liveCallsign || "LIVE RADAR"}
            </span>
          </div>
          <div className="hidden sm:flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#FF4D00] blink-step rounded-full" />
              <span className="text-[10px] font-mono uppercase text-[#111111] font-semibold">
                LIVE ADS-B
              </span>
            </div>
            <span className="text-[10px] text-[#555555] truncate max-w-[130px] font-mono">
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
          <div className="flex justify-between text-[9.5px] font-mono text-[#555555] mb-1 px-1">
            <span>FL360</span>
            <span>FL240</span>
            <span>FL100</span>
            <span>3,000 FT</span>
            <span className="text-[#FF4D00] font-bold">0 FT (TOUCHDOWN)</span>
          </div>

          {/* Calibrated Track with Ticks and Scrubber */}
          <div className="relative h-2 bg-[#D4D3CD] rounded-full overflow-visible flex items-center">
            {/* Tick marks */}
            <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
              <span className="w-[1px] h-2 bg-[#111111]/20" />
              <span className="w-[1px] h-2 bg-[#111111]/20" />
              <span className="w-[1px] h-2 bg-[#111111]/20" />
              <span className="w-[1px] h-2 bg-[#111111]/20" />
              <span className="w-[1px] h-2 bg-[#FF4D00]" />
            </div>

            {/* Active Fill Line */}
            <div
              style={{ width: `${progressPercent}%` }}
              className="h-full bg-[#FF4D00] rounded-full transition-[width] duration-100 ease-out"
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
              className="absolute w-3.5 h-3.5 rounded-full bg-[#111111] border-2 border-[#ECEBE6] pointer-events-none transition-[left] duration-100 ease-out flex items-center justify-center shadow-md"
            >
              <div className="absolute -top-7 px-1.5 py-0.5 bg-[#ECEBE6] border border-[#D4D3CD] rounded-md text-[9px] font-mono text-[#111111] whitespace-nowrap shadow-lg">
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
            <span className="text-[10px] text-[#555555] uppercase">ALT</span>
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-[#111111] tabular-nums">
                {currentAltFt.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#111111] font-semibold">
                FL{currentFlightLevel}
              </span>
            </div>
          </div>

          <div className="w-[1px] h-4 bg-[#D4D3CD]" />

          {/* Metric 2: Ground Speed */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#555555] uppercase">GS</span>
            <span className="font-semibold text-[#111111] tabular-nums">
              {speedKts} <span className="text-[10px] text-[#555555] font-normal">KTS</span>
            </span>
          </div>

          <div className="w-[1px] h-4 bg-[#D4D3CD]" />

          {/* Metric 3: Vertical Climb / Descent Rate */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#555555] uppercase">VSI</span>
            <div className="flex items-center gap-1">
              {vrateFpm > 100 ? (
                <ArrowUpRight className="w-3 h-3 text-[#FF4D00]" />
              ) : vrateFpm < -100 ? (
                <ArrowDownRight className="w-3 h-3 text-[#111111]" />
              ) : (
                <Minus className="w-3 h-3 text-[#555555]" />
              )}
              <span className="font-semibold tabular-nums text-[#111111]">
                {vrateFpm > 0 ? `+${vrateFpm}` : vrateFpm}
              </span>
              <span className="text-[9px] text-[#555555]">FPM</span>
            </div>
          </div>

          <div className="w-[1px] h-4 bg-[#D4D3CD] hidden md:block" />

          {/* Metric 4: Transponder Hex */}
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-[10px] text-[#555555] uppercase">XPNDR</span>
            <span className="px-2 py-0.5 bg-[#ECEBE6] border border-[#D4D3CD] rounded-md font-semibold text-[10.5px] text-[#111111]">
              0x{(liveIcao24 || "39DE4B").toUpperCase().replace("0X", "")}
            </span>
          </div>
        </div>
      )}

      {/* ── RIGHT: SETTLEMENT TRIGGER BUTTON ── */}
      <div className="relative group flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleTriggerClick}
          disabled={isSettling}
          title="Broadcasts a real Arc Testnet transaction spending testnet USDC"
          className={`btn-pill flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold cursor-pointer border shadow-sm ${
            isSettled
              ? "bg-[#D6D5CF] text-[#111111] font-bold border-[#D4D3CD]"
              : isSettling
              ? "bg-[#ECEBE6] text-[#555555] border-[#D4D3CD] opacity-80 animate-pulse cursor-wait"
              : confirmArmed
              ? "bg-[#FF4D00] text-white border-[#FF4D00]"
              : "bg-[#111111] text-[#ECEBE6] hover:bg-[#FF4D00] border-[#111111]"
          }`}
        >
          {isSettled ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#FF4D00]" />
              <span>Settled on Arc</span>
              {settlementTxHash && (
                <a
                  href={`https://testnet.arcscan.app/tx/${settlementTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#111111] hover:text-[#FF4D00] ml-0.5 p-0.5 hover:bg-[#ECEBE6] rounded-full transition-colors"
                  title="Open Transaction on ArcScan Explorer"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </>
          ) : isSettling ? (
            <span>Settling on Arc...</span>
          ) : confirmArmed ? (
            <span>Confirm ${usdcCost.toFixed(2)} real USDC spend</span>
          ) : mode === "live" ? (
            <span>Settle Leg · ${usdcCost.toFixed(2)} USDC</span>
          ) : (
            <span>Settle Wheels-Down · ${usdcCost.toFixed(2)} USDC</span>
          )}
        </button>

        {/* Informative Hover Popover Explaining What This Button Does */}
        <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col w-72 p-3.5 bg-[#ECEBE6] border border-[#D4D3CD] rounded-xl text-[#111111] shadow-2xl z-50 pointer-events-none text-left animate-in fade-in zoom-in-95 duration-140">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#111111] font-bold mb-1">
            <span>ARC SETTLEMENT TRIGGER</span>
            <span className="text-[9px] px-2 py-0.5 bg-[#FF4D00] text-white rounded-full font-bold">1INCH AQUA</span>
          </div>
          <p className="text-[11px] text-[#555555] leading-snug font-sans">
            {mode === "live"
              ? `Executes on-chain retirement of ${((usdcCost / 25) * 1000).toFixed(0)} kg CO₂ for this flight segment using native USDC via SkyRouteVault on Arc Testnet.`
              : "Executes atomic zero-custody wheels-down carbon offset retirement upon touchdown using native Arc USDC."}
          </p>
          <div className="mt-2 pt-2 border-t border-[#D4D3CD] flex items-center justify-between text-[9.5px] font-mono text-[#555555]">
            <span>CHAIN ID: 5042002</span>
            <span className="text-[#FF4D00] font-semibold">ZERO-ESCROW PULL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
