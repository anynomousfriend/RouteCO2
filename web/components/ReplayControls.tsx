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
  const progressPercent = totalFrames > 0 ? (currentIndex / (totalFrames - 1)) * 100 : 0;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-obsidian-900/80 backdrop-blur-md border border-white/10 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Replay Controller
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Frame {currentIndex + 1} / {totalFrames}
          </span>
        </div>

        {/* Speed Toggles */}
        <div className="flex items-center gap-1 bg-obsidian-950 p-0.5 rounded-lg border border-white/5 text-xs font-mono">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeSpeed(s)}
              className={`px-2 py-0.5 rounded-md transition-all ${
                speed === s
                  ? "bg-indigo-500 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Scrub Slider */}
      <div className="relative flex items-center">
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={currentIndex}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-1.5 bg-obsidian-950 rounded-lg appearance-none cursor-pointer accent-indigo-500 border border-white/5"
        />
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-xs shadow-md transition-all active:scale-[0.98]"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>

          <button
            type="button"
            onClick={onStepForward}
            title="Step 1 Frame"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs transition-all active:scale-[0.98]"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onReset}
            title="Reset Replay"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs transition-all active:scale-[0.98]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onJumpToTouchdown}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold transition-all active:scale-[0.98]"
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>Jump to Touchdown 🛬</span>
        </button>
      </div>
    </div>
  );
}
