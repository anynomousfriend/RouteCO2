"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, Plane, Radio, ShieldCheck, ArrowRight } from "lucide-react";
import type { PlayableTrack } from "../lib/replay-tracks";

interface CommandSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: PlayableTrack[];
  onSelectTrack: (track: PlayableTrack) => void;
  onSwitchMode: (mode: "replay" | "live") => void;
  currentMode: "replay" | "live";
}

export function CommandSearchModal({
  isOpen,
  onClose,
  tracks,
  onSelectTrack,
  onSwitchMode,
  currentMode,
}: CommandSearchModalProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setSearch("");
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredTracks = tracks.filter(
    (s) =>
      s.callsign.toLowerCase().includes(search.toLowerCase()) ||
      s.airline.toLowerCase().includes(search.toLowerCase()) ||
      s.airframe.toLowerCase().includes(search.toLowerCase()) ||
      s.destinationAirport.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-24 p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-160"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#272e33] shadow-2xl border border-dashed border-[#d3c6aa]/20 overflow-hidden flex flex-col animate-in zoom-in-95 duration-160 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-dashed border-[#d3c6aa]/16">
          <Search className="w-4 h-4 text-[#859289] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flight callsign, airport, or airframe (e.g. DLH400, MUC)..."
            className="flex-1 bg-transparent text-sm text-[#d3c6aa] placeholder-[#859289] outline-none font-mono"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-[#9daaa4] bg-[#1e2528] border border-[#d3c6aa]/16">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="text-[#859289] hover:text-[#d3c6aa] p-1 hover:bg-[#d3c6aa]/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {/* Quick Mode Switches */}
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#859289]">
            Navigation Modes
          </div>
          <button
            type="button"
            onClick={() => {
              onSwitchMode("replay");
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left ${
              currentMode === "replay"
                ? "bg-[#d3c6aa]/10 font-semibold text-[#d3c6aa]"
                : "text-[#9daaa4] hover:bg-[#d3c6aa]/[0.06]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-[#dbbc7f]" />
              <div>
                <div className="font-medium text-[#d3c6aa]">Replay Recorded Tracks</div>
                <div className="text-[11px] text-[#859289]">
                  Real recorded ADS-B descents — bundled demo seed plus your watches
                </div>
              </div>
            </div>
            {currentMode === "replay" && (
              <span className="text-[10px] font-mono text-[#dbbc7f] font-bold">ACTIVE</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onSwitchMode("live");
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left ${
              currentMode === "live"
                ? "bg-[#d3c6aa]/10 font-semibold text-[#d3c6aa]"
                : "text-[#9daaa4] hover:bg-[#d3c6aa]/[0.06]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#a7c080]" />
              <div>
                <div className="font-medium text-[#d3c6aa]">Live OpenSky Airspace Radar</div>
                <div className="text-[11px] text-[#859289]">
                  Real-time ADS-B transponder telemetry across global skies
                </div>
              </div>
            </div>
            {currentMode === "live" && (
              <span className="text-[10px] font-mono text-[#a7c080] font-bold">ACTIVE</span>
            )}
          </button>

          {/* Recorded replay tracks (bundled demo seed + user recordings) */}
          <div className="px-3 pt-3 pb-1 text-[10px] font-mono uppercase tracking-wider text-[#859289]">
            Replay Tracks (Recorded ADS-B)
          </div>
          {filteredTracks.length === 0 && (
            <div className="px-3 py-4 text-[11px] font-mono text-[#859289] leading-relaxed">
              No recorded tracks yet. Watch a live flight on the globe to record
              its path — it becomes replayable here after touchdown.
            </div>
          )}
          {filteredTracks.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => {
                onSelectTrack(track);
                onClose();
              }}
              className="w-full flex items-center justify-between p-2.5 hover:bg-[#d3c6aa]/[0.06] transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 flex items-center justify-center font-mono text-xs font-bold text-[#dbbc7f]">
                  {track.callsign.slice(0, 3)}
                </div>
                <div>
                  <div className="text-xs font-bold text-[#d3c6aa] flex items-center gap-1.5">
                    <span>{track.callsign}</span>
                    <span className="text-[#859289] font-normal">·</span>
                    <span className="font-normal text-[#9daaa4]">{track.airline}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-mono font-bold ${
                        track.source === "synthetic"
                          ? "bg-[#dbbc7f]/15 text-[#dbbc7f] border border-dashed border-[#dbbc7f]/40"
                          : "bg-[#7fbbb3]/15 text-[#7fbbb3] border border-dashed border-[#7fbbb3]/40"
                      }`}
                    >
                      {track.source === "synthetic"
                        ? "SYNTHETIC FIXTURE"
                        : track.source === "bundled"
                        ? "RECORDED · DEMO SEED"
                        : `RECORDED · ${track.fixCount || 0} FIXES`}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#859289] font-mono">
                    {track.originAirport} → {track.destinationAirport} ({track.destinationName}) · Runway {track.runway}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#859289]/60 group-hover:text-[#a7c080] group-hover:translate-x-0.5 transition-[transform,color] duration-140" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#1e2528] border-t border-dashed border-[#d3c6aa]/16 flex items-center justify-between text-[11px] text-[#859289] font-mono">
          <span>Navigate with mouse or keyboard</span>
          <span>RouteCO2 Protocol v1.0</span>
        </div>
      </div>
    </div>
  );
}
