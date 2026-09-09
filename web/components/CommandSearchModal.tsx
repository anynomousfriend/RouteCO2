"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, Plane, Radio, ShieldCheck, ArrowRight } from "lucide-react";
import { REPLAY_SCENARIOS, type ReplayScenario } from "../lib/replay-scenarios";

interface CommandSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScenario: (scenario: ReplayScenario, index: number) => void;
  onSwitchMode: (mode: "replay" | "live") => void;
  currentMode: "replay" | "live";
}

export function CommandSearchModal({
  isOpen,
  onClose,
  onSelectScenario,
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

  const filteredScenarios = REPLAY_SCENARIOS.filter(
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
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-black/10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-160 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/[0.08]">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flight callsign, airport, or airframe (e.g. DLH400, MUC)..."
            className="flex-1 bg-transparent text-sm text-black placeholder-neutral-400 outline-none font-sans"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-100 rounded border border-neutral-200">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-black p-1 rounded-md hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {/* Quick Mode Switches */}
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
            Navigation Modes
          </div>
          <button
            type="button"
            onClick={() => {
              onSwitchMode("replay");
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
              currentMode === "replay"
                ? "bg-neutral-100 font-semibold text-black"
                : "text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-[#7C4DFF]" />
              <div>
                <div className="font-medium text-black">Touchdown Replay Engine</div>
                <div className="text-[11px] text-neutral-500">
                  Deterministic ICAO wheels-down descent replay
                </div>
              </div>
            </div>
            {currentMode === "replay" && (
              <span className="text-[10px] font-mono text-[#7C4DFF] font-bold">ACTIVE</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onSwitchMode("live");
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
              currentMode === "live"
                ? "bg-neutral-100 font-semibold text-black"
                : "text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-600" />
              <div>
                <div className="font-medium text-black">Live OpenSky Airspace Radar</div>
                <div className="text-[11px] text-neutral-500">
                  Real-time ADS-B transponder telemetry across global skies
                </div>
              </div>
            </div>
            {currentMode === "live" && (
              <span className="text-[10px] font-mono text-emerald-600 font-bold">ACTIVE</span>
            )}
          </button>

          {/* Scenarios */}
          <div className="px-3 pt-3 pb-1 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
            Commercial Scenarios (ICAO Benchmarked)
          </div>
          {filteredScenarios.map((scenario, idx) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => {
                const originalIndex = REPLAY_SCENARIOS.findIndex((s) => s.id === scenario.id);
                onSelectScenario(scenario, originalIndex >= 0 ? originalIndex : idx);
                onClose();
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center font-mono text-xs font-bold text-neutral-800">
                  {scenario.callsign.slice(0, 3)}
                </div>
                <div>
                  <div className="text-xs font-bold text-black flex items-center gap-1.5">
                    <span>{scenario.callsign}</span>
                    <span className="text-neutral-400 font-normal">·</span>
                    <span className="font-normal text-neutral-600">{scenario.airline}</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono">
                    {scenario.originAirport} → {scenario.destinationAirport} ({scenario.destinationName}) · Runway {scenario.runway}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-black group-hover:translate-x-0.5 transition-[transform,color] duration-140" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-neutral-50 border-t border-black/[0.06] flex items-center justify-between text-[11px] text-neutral-400 font-mono">
          <span>Navigate with mouse or keyboard</span>
          <span>RouteCO2 Protocol v1.0</span>
        </div>
      </div>
    </div>
  );
}
