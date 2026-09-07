"use client";

import NumberFlow from "@number-flow/react";
import { Plane, Compass, ArrowUpRight, ArrowDownRight, ShieldCheck, Zap } from "lucide-react";

interface TelemetryData {
  callsign: string;
  baroAltitudeMeters: number;
  velocityMps: number;
  verticalRateMps: number;
  onGround: boolean;
  trueTrackDeg?: number;
}

interface AvionicsHUDProps {
  telemetry: TelemetryData;
  categoryLabel?: string;
  airborneSeconds: number;
  fuelBurnKg: number;
  co2Kg: number;
  usdcCost: number;
  isSettled: boolean;
  settlementTxHash?: string;
}

export default function AvionicsHUD({
  telemetry,
  categoryLabel = "Narrow-body (A320 / B737)",
  airborneSeconds,
  fuelBurnKg,
  co2Kg,
  usdcCost,
  isSettled,
  settlementTxHash,
}: AvionicsHUDProps) {
  const altitudeFeet = Math.round(telemetry.baroAltitudeMeters * 3.28084);
  const speedKnots = Math.round(telemetry.velocityMps * 1.94384);
  const verticalRateFpm = Math.round(telemetry.verticalRateMps * 196.85);

  let phase = "CRUISE";
  let phaseColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";

  if (telemetry.onGround) {
    phase = "WHEELS-DOWN";
    phaseColor = "text-indigo-400 bg-indigo-500/15 border-indigo-500/30";
  } else if (telemetry.verticalRateMps > 2.5) {
    phase = "CLIMB";
    phaseColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
  } else if (telemetry.verticalRateMps < -2.5) {
    phase = telemetry.baroAltitudeMeters < 1000 ? "APPROACH" : "DESCENT";
    phaseColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
  }

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-obsidian-800/80 backdrop-blur-xl border border-white/10 shadow-2xl">
      {/* Top Bar: Callsign & Status Pill */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">{telemetry.callsign}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 font-medium">
                ADS-B
              </span>
            </div>
            <p className="text-xs text-slate-400">{categoryLabel}</p>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${phaseColor}`}>
          <span className="w-2 h-2 rounded-full bg-current animate-ping" />
          <span>{phase}</span>
        </div>
      </div>

      {/* Primary Avionics Telemetry Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Altitude */}
        <div className="p-3.5 rounded-xl bg-obsidian-900/60 border border-white/5 flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
            Baro Altitude
          </span>
          <div className="flex items-baseline gap-1 font-mono text-xl font-semibold text-white">
            <NumberFlow value={altitudeFeet} />
            <span className="text-xs text-slate-400 font-sans">ft</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5">
            {telemetry.baroAltitudeMeters} m
          </span>
        </div>

        {/* Speed */}
        <div className="p-3.5 rounded-xl bg-obsidian-900/60 border border-white/5 flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
            Ground Speed
          </span>
          <div className="flex items-baseline gap-1 font-mono text-xl font-semibold text-white">
            <NumberFlow value={speedKnots} />
            <span className="text-xs text-slate-400 font-sans">kts</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5">
            {telemetry.velocityMps} m/s
          </span>
        </div>

        {/* Vertical Rate / Heading */}
        <div className="p-3.5 rounded-xl bg-obsidian-900/60 border border-white/5 flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>V-Rate</span>
            {telemetry.verticalRateMps >= 0 ? (
              <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 text-amber-400" />
            )}
          </span>
          <div className="flex items-baseline gap-1 font-mono text-xl font-semibold text-white">
            <NumberFlow value={verticalRateFpm} />
            <span className="text-xs text-slate-400 font-sans">fpm</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
            <Compass className="w-3 h-3" /> {telemetry.trueTrackDeg ?? 0}°
          </span>
        </div>
      </div>

      {/* ICAO Emissions & Settlement Card */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-obsidian-900/80 to-obsidian-900 border border-indigo-500/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span>ICAO Verified Reconciliation</span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Airborne: <strong className="text-white">{formatTimer(airborneSeconds)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
          <div>
            <span className="text-[10px] text-slate-400 uppercase">Fuel Burned</span>
            <div className="font-mono text-sm font-semibold text-white mt-0.5">
              <NumberFlow value={Math.round(fuelBurnKg)} /> kg
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase">CO₂ Emitted</span>
            <div className="font-mono text-sm font-semibold text-white mt-0.5">
              <NumberFlow value={Math.round(co2Kg)} /> kg
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase">Offset Cost</span>
            <div className="font-mono text-sm font-semibold text-indigo-400 mt-0.5">
              $<NumberFlow value={Number(usdcCost.toFixed(2))} /> USDC
            </div>
          </div>
        </div>

        {/* Settlement Status Banner */}
        {isSettled ? (
          <div className="mt-1 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-indigo-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Wheels-Down Settled on Arc</span>
            </div>
            {settlementTxHash && (
              <a
                href={`https://testnet.arcscan.app/tx/${settlementTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline font-mono text-[11px]"
              >
                View on ArcScan ↗
              </a>
            )}
          </div>
        ) : (
          <div className="mt-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Awaiting Touchdown Event</span>
            <span className="font-mono text-indigo-400">Zero-Custody Aqua Rail</span>
          </div>
        )}
      </div>
    </div>
  );
}
