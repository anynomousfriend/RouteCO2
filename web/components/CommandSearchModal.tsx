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
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-24 p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-160"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#ECEBE6] text-[#111111] rounded-xl shadow-2xl border border-[#D4D3CD] overflow-hidden flex flex-col animate-in zoom-in-95 duration-160 select-none font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#D4D3CD] bg-[#D6D5CF]/60">
          <Search className="w-4 h-4 text-[#FF4D00] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flight callsign, airport, or airframe (e.g. DLH400, MUC)..."
            className="flex-1 bg-transparent text-sm text-[#111111] placeholder-[#555555] outline-none font-sans"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-[#555555] bg-[#ECEBE6] border border-[#D4D3CD] rounded">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="icon-circle p-1 text-[#555555] hover:text-[#111111] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {/* Quick Mode Switches */}
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#555555]">
            Navigation Modes
          </div>
          <button
            type="button"
            onClick={() => {
              onSwitchMode("replay");
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left rounded-lg ${
              currentMode === "replay"
                ? "bg-[#D6D5CF] font-semibold text-[#111111]"
                : "text-[#555555] hover:bg-[#D6D5CF]/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-[#FF4D00]" />
              <div>
                <div className="font-medium text-[#111111]">Replay Recorded Tracks</div>
                <div className="text-[11px] text-[#555555]">
                  Real recorded ADS-B descents: bundled demo seed plus your watches
                </div>
              </div>
            </div>
            {currentMode === "replay" && (
              <span className="btn-pill px-2 py-0.5 text-[10px] font-mono bg-[#111111] text-[#ECEBE6] font-bold">ACTIVE</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onSwitchMode("live");
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left rounded-lg ${
              currentMode === "live"
                ? "bg-[#D6D5CF] font-semibold text-[#111111]"
                : "text-[#555555] hover:bg-[#D6D5CF]/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#FF4D00]" />
              <div>
                <div className="font-medium text-[#111111]">Live OpenSky Airspace Radar</div>
                <div className="text-[11px] text-[#555555]">
                  Real-time ADS-B transponder telemetry across global skies
                </div>
              </div>
            </div>
            {currentMode === "live" && (
              <span className="btn-pill px-2 py-0.5 text-[10px] font-mono bg-[#111111] text-[#ECEBE6] font-bold">ACTIVE</span>
            )}
          </button>

          {/* Recorded replay tracks */}
          <div className="px-3 pt-3 pb-1 text-[10px] font-mono uppercase tracking-wider text-[#555555]">
            Replay Tracks (Recorded ADS-B)
          </div>
          {filteredTracks.length === 0 && (
            <div className="px-3 py-4 text-[11px] font-mono text-[#555555] leading-relaxed">
              No recorded tracks yet. Watch a live flight on the 2D radar to record
              its path, which becomes replayable here after touchdown.
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
              className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#D6D5CF]/50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-[#D6D5CF] border border-[#D4D3CD] flex items-center justify-center font-mono text-xs font-bold text-[#111111]">
                  {track.callsign.slice(0, 3)}
                </div>
                <div>
                  <div className="text-xs font-bold text-[#111111] flex items-center gap-1.5 font-sans">
                    <span className="font-mono">{track.callsign}</span>
                    <span className="text-[#555555] font-normal">·</span>
                    <span className="font-normal text-[#555555]">{track.airline}</span>
                    <span className="btn-pill px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#ECEBE6] text-[#555555] border border-[#D4D3CD]">
                      {track.source === "synthetic"
                        ? "SYNTHETIC FIXTURE"
                        : track.source === "bundled"
                        ? "RECORDED · DEMO SEED"
                        : `RECORDED · ${track.fixCount || 0} FIXES`}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#555555] font-mono">
                    {track.originAirport} → {track.destinationAirport} ({track.destinationName}) · Runway {track.runway}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#555555] group-hover:text-[#FF4D00] group-hover:translate-x-0.5 transition-[transform,color] duration-140" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#D6D5CF]/60 border-t border-[#D4D3CD] flex items-center justify-between text-[11px] text-[#555555] font-sans">
          <span>Navigate with mouse or keyboard</span>
          <span>RouteCO2 Protocol v1.0</span>
        </div>
      </div>
    </div>
  );
}
