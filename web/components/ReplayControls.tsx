"use client";

import { Play, Pause, SkipForward, RotateCcw, FastForward } from "lucide-react";

interface ReplayControlsProps {
  isPlaying: boolean;
  currentIndex: number;
  totalFrames: number;
  speed: number;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onJumpToTouchdown: () => void;
  onReset: () => void;
  onChangeSpeed: (speed: number) => void;
  onSeek: (index: number) => void;
}

export default function ReplayControls({
  isPlaying,
  currentIndex,
  totalFrames,
  speed,
  onTogglePlay,
  onStepForward,
  onJumpToTouchdown,
  onReset,
  onChangeSpeed,
  onSeek,
}: ReplayControlsProps) {
  const isTouchdown = currentIndex >= 16;

  return (
    <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-[#0B0F19]/90 backdrop-blur-2xl border border-white/[0.08] shadow-2xl">
      {/* Top Scrubber Row */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Descent Track</span>
          <span className="text-white font-semibold">
            Frame {String(currentIndex + 1).padStart(2, "0")} / {totalFrames}
          </span>
          {isTouchdown && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
              TOUCHDOWN
            </span>
          )}
        </div>

        {/* Speed Switcher */}
        <div className="flex items-center gap-1 bg-[#080B11] p-1 rounded-lg border border-white/[0.05]">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeSpeed(s)}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                speed === s
                  ? "bg-indigo-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Scrub Slider */}
      <div className="relative flex items-center py-1">
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={currentIndex}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-1.5 bg-[#080B11] rounded-lg appearance-none cursor-pointer accent-indigo-500 border border-white/[0.05]"
        />
      </div>

      {/* Transport Controls */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 transition-transform active:scale-[0.98]"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? "Pause" : "Play Descent"}</span>
          </button>

          <button
            type="button"
            onClick={onStepForward}
            title="Step 1 Frame"
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] text-xs transition-transform active:scale-[0.98]"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onReset}
            title="Reset Flight"
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] text-xs transition-transform active:scale-[0.98]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onJumpToTouchdown}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-transform active:scale-[0.98]"
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>Scrub to Touchdown 🛬</span>
        </button>
      </div>
    </div>
  );
}
