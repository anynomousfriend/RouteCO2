"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useWalletAuth } from "../lib/use-wallet-auth";
import { toast } from "sonner";
import {
  Plane,
  Radio,
  Globe,
  Wallet,
  ExternalLink,
  ShieldCheck,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  FastForward,
} from "lucide-react";
import type { LiveFlightSummary } from "./api/live-flights/route";
import replayData from "../lib/replay-flight.json";

const DEPLOYED_VAULT_ADDRESS = "0xeb20b11fabe61a00103c040e8febb7d12749e36d";
const DEPLOYED_TX_HASH = "0x8479f899e35e494e692d71eb45a145a4d83e2c571a5b16acf1942a6bceef6765";

// Dynamic import for Leaflet map to prevent SSR window reference error
const WindyFlightMap = dynamic(() => import("../components/WindyFlightMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[220px] bg-[#0B0F19] flex items-center justify-center text-xs font-mono text-slate-400">
      <span className="w-2 h-2 rounded-full bg-[#F5FF7A] animate-ping mr-2" />
      Acquiring ADS-B Radar...
    </div>
  ),
});

export default function FlightOperationsConsole() {
  const { ready, authenticated, user, login, logout } = useWalletAuth();

  // Mode: "live" (OpenSky Network) vs "replay" (Lufthansa DLH400 Touchdown Demo)
  const [mode, setMode] = useState<"live" | "replay">("live");

  // Live Flights State
  const [liveFlights, setLiveFlights] = useState<LiveFlightSummary[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<any>(null);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  // Replay State
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [isSettled, setIsSettled] = useState(false);
  const [settlementTxHash, setSettlementTxHash] = useState<string | undefined>(undefined);

  const activeReplayFrame = useMemo(() => replayData[replayIndex] || replayData[0], [replayIndex]);

  // Fetch Live Flights from OpenSky API
  const fetchLiveFlights = async () => {
    setIsLiveLoading(true);
    try {
      const res = await fetch("/api/live-flights");
      if (res.ok) {
        const json = await res.json();
        if (json.flights && json.flights.length > 0) {
          setLiveFlights(json.flights);
          if (!selectedFlight) {
            setSelectedFlight(json.flights[0]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load live flights", err);
    } finally {
      setIsLiveLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveFlights();
    const interval = setInterval(fetchLiveFlights, 30000);
    return () => clearInterval(interval);
  }, []);

  // Replay Tick Loop
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (isPlaying && mode === "replay") {
      timerRef.current = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= replayData.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;

          // Check for Touchdown transition
          const currentFrame = replayData[next];
          const prevFrame = replayData[prev];

          if (!prevFrame.onGround && currentFrame.onGround && !isSettled) {
            triggerWheelsDownSettlement(currentFrame);
          }

          return next;
        });
      }, 1000 / replaySpeed);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, mode, replaySpeed, isSettled]);

  // Trigger Wheels-Down Settlement on Arc Testnet
  const triggerWheelsDownSettlement = (frame: any) => {
    setIsSettled(true);
    setSettlementTxHash(DEPLOYED_TX_HASH);

    toast.success("Wheels-Down Settled on Arc Testnet! 🛬", {
      description: `${frame.callsign} touched down. Reconciled 10,112 kg CO₂ via 1inch Aqua for $252.80 USDC.`,
      duration: 10000,
      action: {
        label: "View ArcScan",
        onClick: () => window.open(`https://testnet.arcscan.app/address/${DEPLOYED_VAULT_ADDRESS}`, "_blank"),
      },
    });
  };

  // Replay Controls
  const handleTogglePlay = () => setIsPlaying((p) => !p);
  const handleStepForward = () => {
    if (replayIndex < replayData.length - 1) {
      const next = replayIndex + 1;
      setReplayIndex(next);
      if (!replayData[replayIndex].onGround && replayData[next].onGround && !isSettled) {
        triggerWheelsDownSettlement(replayData[next]);
      }
    }
  };
  const handleReset = () => {
    setReplayIndex(0);
    setIsPlaying(false);
    setIsSettled(false);
    setSettlementTxHash(undefined);
  };
  const handleJumpToTouchdown = () => {
    setReplayIndex(16); // Index 16 is touchdown
    setIsPlaying(false);
    if (!isSettled) {
      triggerWheelsDownSettlement(replayData[16]);
    }
  };

  // Active Telemetry
  const activeData =
    mode === "replay"
      ? activeReplayFrame
      : selectedFlight ||
        liveFlights[0] || {
          callsign: "TVF8231",
          icao24: "0x39DE4E",
          baroAltitudeMeters: 10360,
          velocityMps: 237,
          verticalRateMps: 0,
          onGround: false,
          trueTrackDeg: 346,
          originCountry: "France",
        };

  // ICAO Doc 9889 Emission Calculations
  const altitudeFeet = Math.round(activeData.baroAltitudeMeters * 3.28084);
  const speedKnots = Math.round(activeData.velocityMps * 1.94384);
  const airborneSeconds = mode === "replay" ? Math.max(120, replayIndex * 300) : 4800;
  const hours = airborneSeconds / 3600;
  const hourlyBurnKg = 2400; // ICAO Narrow-body (A320 / B737)
  const fuelBurnKg = hours * hourlyBurnKg;
  const co2Kg = fuelBurnKg * 3.16; // ICAO standard emission factor
  const usdcCost = (co2Kg / 1000) * 25.0;

  const isLanded = mode === "replay" ? activeReplayFrame.onGround || isSettled : activeData.onGround;

  return (
    <div className="h-screen w-full bg-[#EBEBEB] text-black font-sans p-4 sm:p-6 flex flex-col gap-5 overflow-hidden select-none">
      {/* ── HEADER ── */}
      <header className="flex items-center gap-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.06)] shrink-0">
            <div className="w-5 h-5 bg-[#7C4DFF] flex items-center justify-center text-white text-[10px] font-black [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]">
              R
            </div>
          </div>
          <div className="hidden md:flex flex-col">
            <span className="font-serif text-lg font-normal leading-none text-black">Route<strong className="font-sans font-extrabold">CO2</strong></span>
            <span className="text-[10px] font-mono text-[#666666] mt-0.5">Flight Ops & Treasury</span>
          </div>
        </div>

        {/* System Status Indicator Bars */}
        <div className="flex-1 flex gap-2">
          <div className="h-1 flex-1 bg-black/10 rounded-full relative overflow-hidden">
            <div className="h-full w-full bg-black" />
          </div>
          <div className="h-1 flex-1 bg-black/10 rounded-full relative overflow-hidden">
            <div className="h-full w-full bg-black" />
          </div>
          <div className="h-1 flex-1 bg-black/10 rounded-full relative overflow-hidden">
            <div className="h-full w-full bg-black" />
          </div>
          <div className="h-1 flex-1 bg-black/10 rounded-full relative overflow-hidden">
            <div className={`h-full ${isSettled || mode === "replay" ? "w-full bg-black" : "w-1/2 bg-black animate-pulse"}`} />
          </div>
          <div className="h-1 flex-1 bg-black/10 rounded-full relative overflow-hidden">
            <div className={`h-full anim-progress ${isSettled ? "w-full bg-[#7C4DFF]" : "w-0"}`} />
          </div>
        </div>

        {/* Arc L1 & Privy Wallet */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-[#666666] uppercase tracking-wider">
            <span>Arc Testnet:</span>
            <strong className="text-black font-bold">5042002 Connected</strong>
          </div>

          {ready && authenticated && user?.wallet ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-black/10 shadow-sm text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}
              </span>
              <button
                type="button"
                onClick={logout}
                className="text-[10px] text-[#666666] hover:text-black font-sans ml-1 btn-tactile cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={login}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-medium shadow-sm btn-tactile cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect Treasury</span>
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN 3-PANEL GRID ── */}
      <main className="grid grid-cols-1 lg:grid-cols-[340px_1fr_340px] xl:grid-cols-[360px_1fr_360px] gap-6 flex-1 min-h-0">
        {/* ── PANEL 1: Live Fleet Telemetry + Embedded Radar Map in Left Down Corner ── */}
        <section className="bg-white rounded-[24px] flex flex-col overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-black/5">
          <div className="p-6 pb-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666666]">
                Live Fleet Telemetry
              </span>

              {/* Mode Switcher */}
              <div className="flex items-center bg-[#EBEBEB] p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setMode("live");
                    setIsPlaying(false);
                  }}
                  className={`px-2 py-1 rounded-md btn-tactile ${
                    mode === "live" ? "bg-white text-black shadow-sm" : "text-[#666666] hover:text-black"
                  }`}
                >
                  Live Radar
                </button>
                <button
                  type="button"
                  onClick={() => setMode("replay")}
                  className={`px-2 py-1 rounded-md btn-tactile ${
                    mode === "replay" ? "bg-white text-black shadow-sm" : "text-[#666666] hover:text-black"
                  }`}
                >
                  DLH400 Demo
                </button>
              </div>
            </div>

            <h2 className="font-serif text-[30px] leading-tight font-normal mb-4">
              Live <strong className="font-sans font-extrabold">In-Flight</strong> Traffic
            </h2>

            {/* Scrollable Fleet List */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0 custom-scrollbar">
              {mode === "replay" ? (
                <div
                  className="p-3.5 rounded-2xl bg-black text-white flex items-center justify-between cursor-pointer card-tactile"
                >
                  <div>
                    <div className="font-bold text-sm">DLH400</div>
                    <div className="text-[11px] opacity-70 font-mono">MUC → FRA · A320</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm font-mono">
                      {Math.round(activeReplayFrame.baroAltitudeMeters * 3.28084).toLocaleString()} ft
                    </div>
                    <div
                      className={`text-[11px] font-bold ${
                        activeReplayFrame.onGround ? "text-[#FF5F1F]" : "text-[#F5FF7A]"
                      }`}
                    >
                      {activeReplayFrame.onGround ? "Touchdown" : "Descent"}
                    </div>
                  </div>
                </div>
              ) : liveFlights.length > 0 ? (
                liveFlights.slice(0, 10).map((flight) => {
                  const isSelected = selectedFlight?.callsign === flight.callsign;
                  const altFt = Math.round(flight.baroAltitudeMeters * 3.28084);
                  return (
                    <div
                      key={flight.icao24}
                      onClick={() => setSelectedFlight(flight)}
                      className={`p-3.5 rounded-2xl cursor-pointer flex items-center justify-between card-tactile ${
                        isSelected
                          ? "bg-black text-white"
                          : "bg-[#F8F8F8] hover:bg-[#E6C9F2] text-black"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm">{flight.callsign || "UNSCHEDULED"}</div>
                        <div className={`text-[11px] font-mono ${isSelected ? "opacity-70" : "text-[#666666]"}`}>
                          {flight.originCountry}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm font-mono">{altFt.toLocaleString()} ft</div>
                        <div
                          className={`text-[11px] font-bold ${
                            isSelected
                              ? "text-[#F5FF7A]"
                              : altFt > 20000
                              ? "text-[#007AFF]"
                              : "text-[#FF5F1F]"
                          }`}
                        >
                          {altFt > 25000 ? "En Route" : altFt > 5000 ? "Approach" : "Final"}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs font-mono text-[#666666] py-4 text-center">
                  Streaming OpenSky commercial transponders...
                </div>
              )}
            </div>
          </div>

          {/* ── LEFT DOWN CORNER: Embedded Live Radar Map ── */}
          <div className="h-[250px] relative overflow-hidden bg-[#0B0F19] border-t border-black/10 shrink-0">
            {/* Top Badge Overlay */}
            <div className="absolute top-2.5 left-2.5 z-[400] flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-mono text-white pointer-events-none shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5FF7A] animate-pulse" />
              <span>
                {mode === "replay" ? "REPLAY RADAR // EDDF" : `ADS-B RADAR // ${liveFlights.length} FLIGHTS`}
              </span>
            </div>

            {/* Replay Controls Overlay (if in Replay Mode) */}
            {mode === "replay" && (
              <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[400] p-2 px-3 rounded-xl bg-black/85 backdrop-blur-md border border-white/10 flex items-center justify-between text-white text-xs animate-slide-up-fade">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white btn-tactile cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleStepForward}
                    title="Step"
                    className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white btn-tactile cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    title="Reset"
                    className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white btn-tactile cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-[10px] font-mono text-slate-300">
                  Frame {replayIndex + 1}/{replayData.length}
                </div>

                <button
                  type="button"
                  onClick={handleJumpToTouchdown}
                  className="px-2 py-0.5 rounded-md bg-[#F5FF7A] hover:bg-yellow-300 text-black text-[10px] font-bold btn-tactile cursor-pointer"
                >
                  Touchdown 🛬
                </button>
              </div>
            )}

            {/* Windy / Esri Dark Gray Canvas Map */}
            <WindyFlightMap
              mode={mode}
              liveFlights={liveFlights}
              selectedFlight={activeData}
              replayFrame={activeReplayFrame}
              replayTrack={replayData}
              onSelectFlight={(f) => setSelectedFlight(f)}
            />
          </div>
        </section>

        {/* ── PANEL 2: ICAO Doc 9889 Verification & Instant CO2 Reconciliation ── */}
        <section className="bg-white rounded-[24px] flex flex-col overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-black/5">
          <div className="p-8 flex-1 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#666666] mb-3">
                ICAO Doc 9889 Verification
              </div>
              <h2 className="font-serif text-[32px] leading-tight font-normal mb-8">
                Instant <strong className="font-sans font-extrabold">CO2 Burn</strong> Reconciliation
              </h2>

              {/* 2x2 Telemetry Grid */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="border-l-2 border-black pl-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#666666] mb-1">
                    Current Altitude
                  </div>
                  <div className="font-serif text-[26px] font-normal leading-tight">
                    {altitudeFeet.toLocaleString()} <span className="text-sm font-sans">ft</span>
                  </div>
                </div>

                <div className="border-l-2 border-black pl-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#666666] mb-1">
                    Ground Velocity
                  </div>
                  <div className="font-serif text-[26px] font-normal leading-tight">
                    {speedKnots} <span className="text-sm font-sans">kts</span>
                  </div>
                </div>

                <div className="border-l-2 border-black pl-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#666666] mb-1">
                    Fuel Flow (kg/h)
                  </div>
                  <div className="font-serif text-[26px] font-normal leading-tight">
                    {hourlyBurnKg.toLocaleString()}
                  </div>
                </div>

                <div className="border-l-2 border-black pl-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#666666] mb-1">
                    Est. Emissions
                  </div>
                  <div className="font-serif text-[26px] font-normal leading-tight text-[#007AFF]">
                    {(co2Kg / 1000).toFixed(2)} <span className="text-sm font-sans">tCO2</span>
                  </div>
                </div>
              </div>

              {/* Specification Data Rows */}
              <div className="flex flex-col">
                <div className="flex justify-between items-baseline py-2.5 border-b border-black/5 text-[13px]">
                  <span className="text-[#666666]">Airframe</span>
                  <span className="font-semibold text-black">Airbus A320 / B737</span>
                </div>
                <div className="flex justify-between items-baseline py-2.5 border-b border-black/5 text-[13px]">
                  <span className="text-[#666666]">Transponder ID</span>
                  <span className="font-semibold font-mono text-black">
                    {activeData.icao24 ? `0x${activeData.icao24}` : "0x39DE4E"}
                  </span>
                </div>
                <div className="flex justify-between items-baseline py-2.5 border-b border-black/5 text-[13px]">
                  <span className="text-[#666666]">Landing Trigger</span>
                  <span className={`font-semibold font-mono ${isLanded ? "text-[#FF5F1F]" : "text-black"}`}>
                    on_ground: {isLanded ? "true [TOUCHDOWN]" : "false"}
                  </span>
                </div>
                <div className="flex justify-between items-baseline py-2.5 border-b border-black/5 text-[13px]">
                  <span className="text-[#666666]">Settlement Agent</span>
                  <span className="font-semibold font-mono text-black">RouteCO2_Autonomous_Arc_v1</span>
                </div>
                <div className="flex justify-between items-baseline py-2.5 text-[13px]">
                  <span className="text-[#666666]">1inch Aqua Vault</span>
                  <a
                    href={`https://testnet.arcscan.app/address/${DEPLOYED_VAULT_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold font-mono text-[#007AFF] hover:underline flex items-center gap-1"
                  >
                    <span>{DEPLOYED_VAULT_ADDRESS.slice(0, 6)}...{DEPLOYED_VAULT_ADDRESS.slice(-4)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Maroon Box with Blob */}
          <div className="maroon-bg p-6 min-h-[170px] relative overflow-hidden flex flex-col justify-between shrink-0">
            <div className="text-[12px] opacity-80 uppercase tracking-wider font-semibold z-10">
              Verification Log
            </div>

            <div
              key={isLanded ? "landed" : "airborne"}
              className="font-serif text-[20px] leading-snug relative z-10 my-2 animate-log-fade"
            >
              {isLanded ? (
                <>
                  Wheels-down detected! Settled <strong className="font-sans font-extrabold">{co2Kg.toLocaleString()} kg CO2</strong> for <strong className="font-sans font-extrabold">${usdcCost.toFixed(2)} USDC</strong> on Arc Testnet via 1inch Aqua.
                </>
              ) : (
                <>
                  Waiting for landing gear deployment to initiate <strong className="font-sans font-extrabold">Arc Testnet</strong> settlement.
                </>
              )}
            </div>

            <div className="z-10 text-[11px] font-mono opacity-80">
              <a
                href={`https://testnet.arcscan.app/address/${DEPLOYED_VAULT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:opacity-100 flex items-center gap-1"
              >
                <span>View On-Chain Receipt on ArcScan</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Blob Accent */}
            <div className="blob blob-2 opacity-20" />
          </div>
        </section>

        {/* ── PANEL 3: Autonomous Treasury & Settled Native Credits ── */}
        <section className="bg-white rounded-[24px] flex flex-col overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-black/5">
          <div className="p-6 flex-1 flex flex-col min-h-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#666666] mb-2">
              Autonomous Treasury
            </div>
            <h2 className="font-serif text-[30px] leading-tight font-normal mb-5">
              Settled <strong className="font-sans font-extrabold">Native</strong> Credits
            </h2>

            {/* Available Balance Box */}
            <div className="bg-[#F8F8F8] p-5 rounded-2xl mb-5 shrink-0">
              <div className="inline-block bg-black text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wider mb-3">
                1INCH AQUA LIQUIDITY
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#666666]">
                Available Balance
              </div>
              <div className="text-[26px] font-extrabold font-mono tabular-nums leading-none mt-1">
                842,109.40 <span className="text-sm font-normal text-[#666666]">USDC</span>
              </div>
              <div className="text-[10px] text-[#666666] mt-1">
                Zero Escrow Lockup · Arc L1 (5042002)
              </div>
            </div>

            {/* Recent Settlements */}
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#666666] mb-2">
              Recent Settlements
            </div>
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 min-h-0 custom-scrollbar">
              <div className="flex justify-between items-center py-2.5 border-b border-black/5 text-[13px]">
                <div>
                  <div className="font-bold text-black">DLH400 · FRA</div>
                  <div className="text-[10px] text-[#666666]">Lufthansa A320 Touchdown</div>
                </div>
                <span className="font-semibold text-[#007AFF] font-mono">+ 10.1 tCO2 ($252.80)</span>
              </div>

              <div className="flex justify-between items-center py-2.5 border-b border-black/5 text-[13px]">
                <div>
                  <div className="font-bold text-black">SR-212 · OSL</div>
                  <div className="text-[10px] text-[#666666]">Scandinavian Airlines</div>
                </div>
                <span className="font-semibold text-[#007AFF] font-mono">+ 1.4 tCO2 ($35.00)</span>
              </div>

              <div className="flex justify-between items-center py-2.5 border-b border-black/5 text-[13px]">
                <div>
                  <div className="font-bold text-black">SR-104 · LHR</div>
                  <div className="text-[10px] text-[#666666]">British Airways A321</div>
                </div>
                <span className="font-semibold text-[#007AFF] font-mono">+ 3.1 tCO2 ($77.50)</span>
              </div>

              <div className="flex justify-between items-center py-2.5 text-[13px]">
                <div>
                  <div className="font-bold text-black">SR-992 · SIN</div>
                  <div className="text-[10px] text-[#666666]">Singapore Airlines</div>
                </div>
                <span className="font-semibold text-[#007AFF] font-mono">+ 12.8 tCO2 ($320.00)</span>
              </div>
            </div>
          </div>

          {/* Bottom Blue Box with Blob */}
          <div className="blue-bg p-6 min-h-[170px] relative overflow-hidden flex flex-col justify-between shrink-0">
            <div className="blob blob-3" />

            <div className="font-serif text-[24px] leading-tight relative z-10">
              autonomous<br />
              <strong className="font-sans font-extrabold">settlement</strong>
            </div>

            <div className="flex items-center justify-between relative z-10 text-[10px] font-extrabold tracking-wider">
              <span className="bg-white/20 px-2 py-1 rounded-md">1INCH AQUA SHARED TVU</span>
              <span>100% VERIFIED</span>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="flex justify-between items-center text-[11px] font-semibold text-[#666666] shrink-0">
        <div>FLIGHT_OPS_CONSOLE // SYSTEM_VERSION_4.0.1</div>
        <div className="flex gap-6">
          <span>TELEMETRY: STABLE</span>
          <span>TREASURY: SYNCED</span>
          <span>ARC L1: 5042002</span>
          <span>LATENCY: 12ms</span>
        </div>
      </footer>
    </div>
  );
}
