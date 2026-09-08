"use client";

import NumberFlow from "@number-flow/react";
import { Plane, Compass, ArrowUpRight, ArrowDownRight, ShieldCheck, Zap, ExternalLink, Clock } from "lucide-react";

export interface TelemetryData {
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
  vaultAddress?: string;
}

export default function AvionicsHUD({
  telemetry,
  categoryLabel = "Narrow-body (A320 / B737)",
  airborneSeconds,
  fuelBurnKg,
  co2Kg,
  usdcCost,
  isSettled,
  settlementTxHash = "0x8479f899e35e494e692d71eb45a145a4d83e2c571a5b16acf1942a6bceef6765",
  vaultAddress = "0xeb20b11fabe61a00103c040e8febb7d12749e36d",
}: AvionicsHUDProps) {
  const altitudeFeet = Math.round(telemetry.baroAltitudeMeters * 3.28084);
  const speedKnots = Math.round(telemetry.velocityMps * 1.94384);
  const verticalRateFpm = Math.round(telemetry.verticalRateMps * 196.85);

  let phase = "CRUISE";
  let phaseBadge = "text-indigo-400 bg-indigo-500/10 border-indigo-500/30";

  if (telemetry.onGround || isSettled) {
    phase = "WHEELS-DOWN";
    phaseBadge = "text-emerald-400 bg-emerald-500/15 border-emerald-500/40";
  } else if (telemetry.verticalRateMps > 2.5) {
    phase = "CLIMB";
    phaseBadge = "text-amber-400 bg-amber-500/10 border-amber-500/30";
  } else if (telemetry.verticalRateMps < -2.5) {
    phase = telemetry.baroAltitudeMeters < 1000 ? "APPROACH" : "DESCENT";
    phaseBadge = "text-indigo-400 bg-indigo-500/15 border-indigo-500/40";
  }

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── CARD 1: Avionics & Settlement HUD ── */}
      <div className="p-5 rounded-2xl bg-[#0e1424]/90 backdrop-blur-xl border border-white/[0.08] shadow-2xl flex flex-col gap-3.5">
        {/* Flight Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Plane className="w-5 h-5 -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-mono font-bold tracking-tight text-white leading-none">
                  {telemetry.callsign}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-slate-300 font-semibold">
                  ADS-B
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-1">{categoryLabel}</p>
            </div>
          </div>

          <div className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold border flex items-center gap-1.5 shadow-sm ${phaseBadge}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            <span>{phase}</span>
          </div>
        </div>

        {/* 3 Primary Avionics Gauges */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Altitude */}
          <div className="p-3 rounded-xl bg-[#080B11]/80 border border-white/[0.05] flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-0.5">
              BARO ALTITUDE
            </span>
            <div className="flex items-baseline gap-1 font-mono text-lg font-bold text-white tabular-nums">
              <NumberFlow value={altitudeFeet} />
              <span className="text-[10px] text-slate-400 font-sans">ft</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
              {telemetry.baroAltitudeMeters} m
            </span>
          </div>

          {/* Speed */}
          <div className="p-3 rounded-xl bg-[#080B11]/80 border border-white/[0.05] flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-0.5">
              GROUND SPEED
            </span>
            <div className="flex items-baseline gap-1 font-mono text-lg font-bold text-white tabular-nums">
              <NumberFlow value={speedKnots} />
              <span className="text-[10px] text-slate-400 font-sans">kts</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
              {telemetry.velocityMps} m/s
            </span>
          </div>

          {/* Vertical Rate */}
          <div className="p-3 rounded-xl bg-[#080B11]/80 border border-white/[0.05] flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-0.5 flex items-center justify-between">
              <span>V-RATE</span>
              {telemetry.verticalRateMps >= 0 ? (
                <ArrowUpRight className="w-3 h-3 text-cyan-400" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-amber-400" />
              )}
            </span>
            <div className="flex items-baseline gap-1 font-mono text-lg font-bold text-white tabular-nums">
              <NumberFlow value={verticalRateFpm} />
              <span className="text-[10px] text-slate-400 font-sans">fpm</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
              <Compass className="w-2.5 h-2.5 text-slate-400" /> {telemetry.trueTrackDeg ?? 0}°
            </span>
          </div>
        </div>

        {/* ICAO Verified Reconciliation Box */}
        <div className="p-4 rounded-xl bg-[#080B11]/80 border border-white/[0.06] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider text-indigo-400">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>ICAO VERIFIED RECONCILIATION</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Airborne: <strong className="text-white">{formatTimer(airborneSeconds)}</strong>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.05]">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono">FUEL BURNED</span>
              <div className="font-mono text-sm font-bold text-white mt-0.5 tabular-nums">
                <NumberFlow value={Math.round(fuelBurnKg)} /> kg
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono">CO₂ EMITTED</span>
              <div className="font-mono text-sm font-bold text-white mt-0.5 tabular-nums">
                <NumberFlow value={Math.round(co2Kg)} /> kg
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono">OFFSET COST</span>
              <div className="font-mono text-sm font-bold text-indigo-400 mt-0.5 tabular-nums">
                $<NumberFlow value={Number(usdcCost.toFixed(1))} /> USDC
              </div>
            </div>
          </div>

          {/* Settlement Status Banner */}
          {isSettled ? (
            <div className="mt-1 p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Wheels-Down Settled on Arc</span>
              </div>
              <a
                href={`https://testnet.arcscan.app/address/${vaultAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-mono underline"
              >
                <span>View on ArcScan</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className="mt-1 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span>Awaiting Touchdown</span>
              </div>
              <span className="text-indigo-400">1inch Aqua Virtual Quote Active</span>
            </div>
          )}
        </div>
      </div>

      {/* ── CARD 2: Privy Scoped Manifest Session ── */}
      <div className="p-4 rounded-2xl bg-[#0e1424]/90 backdrop-blur-xl border border-white/[0.08] shadow-2xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-white">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Privy Scoped Manifest Session</span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 text-[10px] font-mono font-bold">
            ACTIVE
          </span>
        </div>

        <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
          Authorized Circle Agent to settle up to <strong className="text-white font-mono">$500.00 USDC</strong> on Arc Testnet strictly to <strong className="text-white font-mono">SkyRouteVault</strong> with zero runtime popups.
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.05] text-[10px] font-mono text-slate-400">
          <span>Expiry: ETA + 2h</span>
          <span>
            Whitelisted Contract:{" "}
            <a
              href={`https://testnet.arcscan.app/address/${vaultAddress}`}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              {vaultAddress.slice(0, 6)}...{vaultAddress.slice(-4)}
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
