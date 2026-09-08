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
  Loader2,
} from "lucide-react";
import type { LiveFlightSummary } from "./api/live-flights/route";
import replayData from "../lib/replay-flight.json";
import { formatEther } from "viem";
import {
  publicArcClient,
  SKYROUTE_VAULT_ADDRESS,
  SKYROUTE_VAULT_ABI,
} from "../lib/arc-client";

const DEPLOYED_VAULT_ADDRESS = SKYROUTE_VAULT_ADDRESS;
const DEPLOYED_AQUA_ADDRESS = "0x6268472c27a6a25ab85713b51f1485c991f0cf9f";

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

interface OnChainSettlementItem {
  flightId: string;
  callsign: string;
  airborneSeconds: number;
  co2Kg: number;
  usdcAmount: number;
  blockNumber: number;
  txHash: string;
}

export default function FlightOperationsConsole() {
  const { ready, authenticated, user, login, logout } = useWalletAuth();

  // Mode: "live" (OpenSky Network) vs "replay" (Lufthansa DLH400 Touchdown Demo)
  const [mode, setMode] = useState<"live" | "replay">("live");

  // Live Flights State
  const [liveFlights, setLiveFlights] = useState<LiveFlightSummary[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<LiveFlightSummary | null>(null);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  // Replay State
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [isSettled, setIsSettled] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settlementTxHash, setSettlementTxHash] = useState<string | undefined>(undefined);

  // On-Chain Event Logs
  const [onChainEvents, setOnChainEvents] = useState<OnChainSettlementItem[]>([]);
  const [rpcLatencyMs, setRpcLatencyMs] = useState<number | null>(null);

  const activeReplayFrame = useMemo(
    () => replayData[replayIndex] || replayData[0],
    [replayIndex]
  );

  // Active Treasury Wallet on Arc Testnet
  const activeWalletAddress =
    user?.wallet?.address || "0x1698fdA3A9A8Ca9530434e545986176579F01650";
  const [treasuryBalance, setTreasuryBalance] = useState<string | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);

  // Fetch On-Chain Treasury Balance
  useEffect(() => {
    let isMounted = true;
    const fetchBalance = async () => {
      try {
        const bal = await publicArcClient.getBalance({
          address: activeWalletAddress as `0x${string}`,
        });
        if (isMounted) {
          const formatted = parseFloat(formatEther(bal)).toFixed(2);
          setTreasuryBalance(formatted);
        }
      } catch (err) {
        console.error("Failed to query live Arc balance", err);
      } finally {
        if (isMounted) setIsBalanceLoading(false);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeWalletAddress]);

  // Fetch On-Chain Recent Settlements
  const fetchRecentSettlements = async () => {
    try {
      const fromBlock = 61044000n;
      const logs = await publicArcClient.getContractEvents({
        address: DEPLOYED_VAULT_ADDRESS,
        abi: SKYROUTE_VAULT_ABI,
        eventName: "WheelsDownSettled",
        fromBlock,
      });

      const parsed: OnChainSettlementItem[] = logs
        .map((log) => {
          const args = log.args as any;
          return {
            flightId: String(args.flightId || ""),
            callsign: String(args.callsign || "FLIGHT"),
            airborneSeconds: Number(args.airborneSeconds || 0),
            co2Kg: Number(args.co2Kg || 0),
            usdcAmount: Number(args.usdcAmount || 0) / 1_000_000,
            blockNumber: Number(log.blockNumber || 0),
            txHash: String(log.transactionHash || ""),
          };
        })
        .reverse();

      setOnChainEvents(parsed.slice(0, 5));
    } catch (err) {
      console.error("Failed to load on-chain settlement events:", err);
    }
  };

  useEffect(() => {
    fetchRecentSettlements();
    const interval = setInterval(fetchRecentSettlements, 15000);
    return () => clearInterval(interval);
  }, []);

  // Measure Real RPC Ping Latency
  useEffect(() => {
    let isMounted = true;
    const pingRpc = async () => {
      const start = performance.now();
      try {
        await publicArcClient.getBlockNumber();
        const latency = Math.round(performance.now() - start);
        if (isMounted) setRpcLatencyMs(latency);
      } catch {
        if (isMounted) setRpcLatencyMs(null);
      }
    };
    pingRpc();
    const interval = setInterval(pingRpc, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

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

  // Trigger Real Wheels-Down Settlement on Arc Testnet via /api/settle
  const triggerWheelsDownSettlement = async (frame: any) => {
    if (isSettling) return;
    setIsSettling(true);

    const toastId = toast.loading(
      `Broadcasting Wheels-Down Settlement for ${frame.callsign} to Arc Testnet...`
    );

    try {
      const res = await fetch("/api/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callsign: frame.callsign || "DLH400",
          aircraftCategory: "NARROW_BODY",
          airborneSeconds: trancheMinutes * 60,
          fuelBurnKg,
          co2Kg,
          usdcAmount: BigInt(Math.round(usdcCost * 1_000_000)).toString(),
          treasuryAddress: activeWalletAddress,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "On-chain transaction execution failed");
      }

      setIsSettled(true);
      setSettlementTxHash(data.settleTxHash);

      toast.success("Wheels-Down Settled on Arc Testnet! 🛬", {
        id: toastId,
        description: `${frame.callsign} reconciled on-chain. Block #${data.blockNumber} (Gas: ${data.gasUsed}).`,
        duration: 12000,
        action: {
          label: "View ArcScan",
          onClick: () => window.open(data.explorerUrl, "_blank"),
        },
      });

      await fetchRecentSettlements();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Settlement broadcast failed";
      toast.error("Settlement Failed", {
        id: toastId,
        description: msg,
      });
    } finally {
      setIsSettling(false);
    }
  };

  // Replay Tick Loop
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (mode === "replay" && isPlaying) {
      timerRef.current = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= replayData.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          const currentFrame = replayData[next];
          const prevFrame = replayData[prev];

          if (!prevFrame.onGround && currentFrame.onGround && !isSettled && !isSettling) {
            triggerWheelsDownSettlement(currentFrame);
          }

          return next;
        });
      }, 1000 / replaySpeed);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, mode, replaySpeed, isSettled, isSettling]);

  // Replay Controls
  const handleTogglePlay = () => setIsPlaying((p) => !p);
  const handleStepForward = () => {
    if (replayIndex < replayData.length - 1) {
      const next = replayIndex + 1;
      setReplayIndex(next);
      if (!replayData[replayIndex].onGround && replayData[next].onGround && !isSettled && !isSettling) {
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
    // Frame index 16 is touchdown in replay-flight.json
    setReplayIndex(16);
    setIsPlaying(false);
    if (!isSettled && !isSettling) {
      triggerWheelsDownSettlement(replayData[16]);
    }
  };

  // Active Telemetry (Zero-Mock: renders null if no live flight is acquired yet)
  const activeData =
    mode === "replay"
      ? activeReplayFrame
      : selectedFlight ||
        (liveFlights.length > 0 ? liveFlights[0] : null);

  // ICAO Doc 9889 Emission Calculations
  const altitudeFeet = activeData ? Math.round(activeData.baroAltitudeMeters * 3.28084) : 0;
  const speedKnots = activeData ? Math.round(activeData.velocityMps * 1.94384) : 0;
  const hourlyBurnKg = 2400; // ICAO Narrow-body benchmark (A320 / B737)
  
  // Waypoint Approach & Touchdown Tranche
  const trancheMinutes = mode === "replay" ? Math.max(1, Math.round((replayIndex + 1) * 0.25)) : 5;
  const fuelBurnKg = Math.round((trancheMinutes / 60) * hourlyBurnKg);
  const co2Kg = Math.round(fuelBurnKg * 3.16); // ICAO standard emission factor
  const usdcCost = Math.max(0.35, +((co2Kg / 1000) * 5.0).toFixed(2));

  const isLanded =
    mode === "replay"
      ? activeReplayFrame.onGround || isSettled
      : Boolean(activeData?.onGround);

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

        {/* Dynamic Status Indicator Bars */}
        <div className="flex-1 flex gap-2">
          <div className="h-1 flex-1 bg-black/10 rounded-full relative overflow-hidden">
            <div className={`h-full bg-black transition-all ${activeData ? "w-full" : "w-1/3 animate-pulse"}`} />
          </div>
          <div className="h-1 flex-1 bg-black/10 rounded-full relative overflow-hidden">
            <div className={`h-full bg-black transition-all ${activeData ? "w-full" : "w-1/3 animate-pulse"}`} />
          </div>
          <div className="h-1 flex-1 bg-black/10 rounded-full relative overflow-hidden">
            <div className={`h-full bg-black transition-all ${mode === "replay" || activeData ? "w-full" : "w-0"}`} />
          </div>
          <div className="h-1 flex-1 bg-black/10 rounded-full relative overflow-hidden">
            <div className={`h-full transition-all ${isSettled || isLanded ? "w-full bg-black" : isPlaying ? "w-2/3 bg-black animate-pulse" : "w-1/4 bg-black"}`} />
          </div>
          <div className="h-1 flex-1 bg-black/10 rounded-full relative overflow-hidden">
            <div className={`h-full anim-progress transition-all ${isSettled ? "w-full bg-[#7C4DFF]" : isSettling ? "w-3/4 bg-[#7C4DFF] animate-pulse" : "w-0"}`} />
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

      {/* ── MAIN FLIGHT CONSOLE (3 COLUMNS) ── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
        {/* ── LEFT COLUMN (4 Cols): Dual-Mode Selector & Fleet / Replay HUD ── */}
        <section className="lg:col-span-4 flex flex-col gap-4 min-h-0">
          {/* Mode Switcher */}
          <div className="flex p-1 bg-white rounded-xl border border-black/10 shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => {
                setMode("live");
                setIsPlaying(false);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer btn-tactile ${
                mode === "live"
                  ? "bg-black text-white shadow-sm"
                  : "text-[#666666] hover:text-black"
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${mode === "live" ? "text-[#F5FF7A] animate-pulse" : ""}`} />
              <span>Live Radar (ADS-B)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("replay");
                setIsPlaying(false);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer btn-tactile ${
                mode === "replay"
                  ? "bg-[#7C4DFF] text-white shadow-sm"
                  : "text-[#666666] hover:text-black"
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              <span>DLH400 Replay Demo</span>
            </button>
          </div>

          {/* Top Info Card */}
          <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm flex flex-col shrink-0">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666666]">
                  {mode === "replay" ? "Demonstration Flight" : "Active In-Flight Radar Target"}
                </span>
                <div className="font-serif text-[32px] font-normal leading-none mt-1">
                  {mode === "replay"
                    ? "DLH400"
                    : activeData?.callsign || (isLiveLoading ? "Scanning..." : "No Signal")}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666666]">
                  Arc Treasury
                </span>
                <div className="font-serif text-[24px] font-normal leading-none mt-1 text-emerald-600">
                  {isBalanceLoading ? (
                    <span className="text-base text-[#666666] font-mono animate-pulse">Querying...</span>
                  ) : (
                    `$${treasuryBalance || "0.00"} USDC`
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-[#666666] leading-relaxed">
              {mode === "replay"
                ? "Lufthansa commercial descent entering Frankfurt (EDDF). Evaluates fuel dynamics and triggers zero-custody 1inch Aqua offset on Arc Testnet."
                : "Continuous ADS-B transponder telemetry evaluated against ICAO Doc 9889 fuel consumption standards."}
            </p>
          </div>

          {/* Mode-Specific Panel: Replay Controls OR Live Fleet List */}
          <div className="flex-1 bg-white rounded-2xl p-4 border border-black/5 shadow-sm flex flex-col min-h-0 overflow-hidden">
            {mode === "replay" ? (
              <div className="flex flex-col h-full justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="text-[#666666] font-semibold">WAYPOINT APPROACH</span>
                    <span className="font-bold">
                      Frame {String(replayIndex + 1).padStart(2, "0")} / {replayData.length}
                    </span>
                  </div>

                  {/* Scrubber */}
                  <input
                    type="range"
                    min={0}
                    max={replayData.length - 1}
                    value={replayIndex}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setReplayIndex(idx);
                      if (replayData[idx].onGround && !isSettled && !isSettling) {
                        triggerWheelsDownSettlement(replayData[idx]);
                      }
                    }}
                    className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#7C4DFF]"
                  />

                  {/* Status Banner */}
                  <div className={`mt-3 p-3 rounded-xl flex items-center justify-between text-xs font-mono transition-colors ${
                    isSettled
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-700"
                      : isLanded
                      ? "bg-[#FF5F1F]/10 border border-[#FF5F1F]/30 text-[#FF5F1F]"
                      : "bg-neutral-100 text-neutral-700"
                  }`}>
                    <span className="font-bold">
                      {isSettling
                        ? "BROADCASTING SETTLEMENT..."
                        : isSettled
                        ? "SETTLED ON ARC TESTNET"
                        : isLanded
                        ? "TOUCHDOWN DETECTED"
                        : "DESCENT IN PROGRESS"}
                    </span>
                    <span>
                      {isSettling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isSettled ? (
                        "Verified"
                      ) : (
                        `${activeReplayFrame.baroAltitudeMeters}m Alt`
                      )}
                    </span>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="flex flex-col gap-2 pt-2 border-t border-black/5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleTogglePlay}
                        disabled={isSettling}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black hover:bg-neutral-800 text-white font-semibold text-xs btn-tactile cursor-pointer disabled:opacity-50"
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        <span>{isPlaying ? "Pause" : "Play"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleStepForward}
                        disabled={isSettling}
                        title="Step 1 Frame"
                        className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-black text-xs btn-tactile cursor-pointer disabled:opacity-50"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={isSettling}
                        title="Reset"
                        className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-black text-xs btn-tactile cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Speed buttons */}
                    <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-[10px] font-mono font-bold">
                      {[1, 2, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setReplaySpeed(s)}
                          className={`px-2 py-0.5 rounded cursor-pointer btn-tactile ${
                            replaySpeed === s ? "bg-white text-black shadow-sm" : "text-[#666666]"
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleJumpToTouchdown}
                    disabled={isSettled || isSettling}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm btn-tactile cursor-pointer disabled:opacity-40"
                  >
                    {isSettling ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Confirming on ArcScan...</span>
                      </>
                    ) : (
                      <>
                        <FastForward className="w-3.5 h-3.5" />
                        <span>Jump to Touchdown & Settle</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-0">
                <div className="flex justify-between items-center mb-2 shrink-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666666]">
                    Active Transponders ({liveFlights.length})
                  </span>
                  <button
                    type="button"
                    onClick={fetchLiveFlights}
                    disabled={isLiveLoading}
                    className="text-[10px] text-[#007AFF] hover:underline font-mono cursor-pointer disabled:opacity-50"
                  >
                    {isLiveLoading ? "Polling..." : "Refresh"}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
                  {liveFlights.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-[#666666] font-mono py-8">
                      <Radio className="w-6 h-6 text-[#7C4DFF] animate-pulse mb-2" />
                      <span>Scanning European Flight Corridor...</span>
                      <span className="text-[10px] text-neutral-400 mt-1">Connecting to OpenSky Network ADS-B</span>
                    </div>
                  ) : (
                    liveFlights.map((flight) => {
                      const isSelected = selectedFlight?.callsign === flight.callsign;
                      const altFt = Math.round(flight.baroAltitudeMeters * 3.28084);
                      return (
                        <div
                          key={flight.icao24}
                          onClick={() => setSelectedFlight(flight)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all card-tactile ${
                            isSelected
                              ? "bg-neutral-50 border-black shadow-sm"
                              : "bg-white border-black/5 hover:border-black/20"
                          }`}
                        >
                          <div className="flex justify-between items-center font-mono">
                            <span className="font-bold text-black">{flight.callsign}</span>
                            <span className="text-[10px] text-emerald-600 font-semibold">
                              {altFt.toLocaleString()} ft
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-[#666666] mt-1 font-sans">
                            <span>{flight.originCountry}</span>
                            <span className="font-mono">{Math.round(flight.velocityMps * 1.94384)} kts</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── CENTER COLUMN (5 Cols): Live Radar Map Canvas ── */}
        <section className="lg:col-span-5 flex flex-col min-h-0">
          <div className="flex-1 bg-white rounded-2xl p-3 border border-black/5 shadow-sm flex flex-col min-h-0 relative overflow-hidden">
            {/* Map Header Overlay */}
            <div className="flex justify-between items-center mb-2 px-2 shrink-0">
              <div className="flex items-center gap-2 text-xs font-mono font-bold">
                <Globe className="w-3.5 h-3.5 text-[#007AFF]" />
                <span>ADS-B RADAR CANVAS</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#666666]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>OpenSky Feed Live</span>
              </div>
            </div>

            {/* Fullscreen Map Canvas */}
            <div className="flex-1 rounded-xl overflow-hidden border border-black/5 relative min-h-[260px]">
              <WindyFlightMap
                mode={mode}
                liveFlights={liveFlights}
                selectedFlight={selectedFlight}
                replayFrame={mode === "replay" ? activeReplayFrame : null}
                replayTrack={mode === "replay" ? replayData : []}
                onSelectFlight={(flight) => {
                  if ("icao24" in flight) {
                    setSelectedFlight(flight as LiveFlightSummary);
                    setMode("live");
                  }
                }}
              />
            </div>
          </div>
        </section>

        {/* ── RIGHT COLUMN (3 Cols): Telemetry HUD, On-Chain Specs & Activity ── */}
        <section className="lg:col-span-3 flex flex-col gap-4 min-h-0 overflow-y-auto pr-0.5 custom-scrollbar">
          {/* Telemetry Card */}
          <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm flex flex-col shrink-0">
            <h2 className="font-serif text-xl font-normal leading-none mb-4 text-black">
              ICAO Reconciliation
            </h2>

            {/* 2x2 Telemetry Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="border-l-2 border-black pl-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#666666] mb-0.5">
                  Current Alt
                </div>
                <div className="font-serif text-[22px] font-normal leading-tight">
                  {altitudeFeet.toLocaleString()} <span className="text-xs font-sans">ft</span>
                </div>
              </div>

              <div className="border-l-2 border-black pl-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#666666] mb-0.5">
                  Ground Speed
                </div>
                <div className="font-serif text-[22px] font-normal leading-tight">
                  {speedKnots} <span className="text-xs font-sans">kts</span>
                </div>
              </div>

              <div className="border-l-2 border-black pl-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#666666] mb-0.5">
                  Fuel Flow
                </div>
                <div className="font-serif text-[22px] font-normal leading-tight">
                  {hourlyBurnKg.toLocaleString()} <span className="text-xs font-sans">kg/h</span>
                </div>
              </div>

              <div className="border-l-2 border-black pl-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#666666] mb-0.5">
                  Est. CO₂
                </div>
                <div className="font-serif text-[22px] font-normal leading-tight text-[#007AFF]">
                  {(co2Kg / 1000).toFixed(2)} <span className="text-xs font-sans">t</span>
                </div>
              </div>
            </div>

            {/* Specification Data Rows */}
            <div className="flex flex-col text-xs border-t border-black/5 pt-2">
              <div className="flex justify-between items-baseline py-1.5 border-b border-black/5">
                <span className="text-[#666666]">Airframe</span>
                <span className="font-semibold text-black">A320 / B737</span>
              </div>
              <div className="flex justify-between items-baseline py-1.5 border-b border-black/5">
                <span className="text-[#666666]">Transponder</span>
                <span className="font-semibold font-mono text-black">
                  {activeData && "icao24" in activeData && activeData.icao24
                    ? `0x${(activeData as any).icao24.toUpperCase()}`
                    : mode === "replay"
                    ? "0x3C6544"
                    : "ACQUIRING..."}
                </span>
              </div>
              <div className="flex justify-between items-baseline py-1.5 border-b border-black/5">
                <span className="text-[#666666]">Touchdown Trigger</span>
                <span className={`font-semibold font-mono ${isLanded ? "text-[#FF5F1F]" : "text-black"}`}>
                  {isLanded ? "on_ground: true 🛬" : "airborne"}
                </span>
              </div>
              <div className="flex justify-between items-baseline py-1.5">
                <span className="text-[#666666]">1inch Aqua Vault</span>
                <a
                  href={`https://testnet.arcscan.app/address/${DEPLOYED_VAULT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold font-mono text-[#007AFF] hover:underline flex items-center gap-0.5"
                >
                  <span>{DEPLOYED_VAULT_ADDRESS.slice(0, 6)}...{DEPLOYED_VAULT_ADDRESS.slice(-4)}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Recent On-Chain Settlements Feed */}
          <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm flex flex-col shrink-0">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666666]">
                Verified Arc Settlements
              </span>
              <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                LIVE ON-CHAIN
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Active demo flight card if settled */}
              {isSettled && settlementTxHash && (
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-300">
                  <div className="flex justify-between items-start text-[13px]">
                    <div>
                      <div className="font-bold text-black flex items-center gap-1.5">
                        <span>DLH400 · FRA</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500 text-white">
                          JUST SETTLED
                        </span>
                      </div>
                      <div className="text-[10px] text-[#666666] mt-0.5 font-mono">
                        Lufthansa A320 · Touchdown Reconciled
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-xs text-emerald-600">
                        + {co2Kg} kg CO₂
                      </div>
                      <div className="text-[10px] text-[#666666]">
                        ${usdcCost.toFixed(2)} USDC
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-emerald-200/60 flex justify-between items-center text-[10px] font-mono">
                    <span className="text-emerald-700">1inch Aqua Shared TVU</span>
                    <a
                      href={`https://testnet.arcscan.app/tx/${settlementTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#007AFF] hover:underline flex items-center gap-0.5"
                    >
                      <span>ArcScan Receipt</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Real On-Chain Settlements from contract events */}
              {onChainEvents.map((evt, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-neutral-50/70 border border-black/5 hover:border-black/15 transition-colors">
                  <div className="flex justify-between items-center font-mono">
                    <span className="font-bold text-black">{evt.callsign}</span>
                    <span className="text-[10px] font-bold text-emerald-600">
                      {evt.co2Kg} kg CO₂
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#666666] mt-1">
                    <span>Block #{evt.blockNumber}</span>
                    <a
                      href={`https://testnet.arcscan.app/tx/${evt.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#007AFF] hover:underline flex items-center gap-0.5"
                    >
                      <span>Tx {evt.txHash.slice(0, 6)}...</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ))}

              {/* Protocol Genesis Card */}
              <div className="p-2.5 rounded-xl bg-white border border-black/5 text-[10px] font-mono text-[#666666] flex justify-between items-center">
                <span>AquaCore Registry</span>
                <a
                  href={`https://testnet.arcscan.app/address/${DEPLOYED_AQUA_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#007AFF] hover:underline flex items-center gap-0.5"
                >
                  <span>{DEPLOYED_AQUA_ADDRESS.slice(0, 6)}...</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="flex justify-between items-center text-[11px] font-semibold text-[#666666] shrink-0">
        <div>ROUTECO2 // AUTONOMOUS_FLIGHT_DISPATCHER</div>
        <div className="flex gap-6">
          <span>TELEMETRY: {activeData ? "STABLE" : "SCANNING"}</span>
          <span>TREASURY: {treasuryBalance ? "SYNCED" : "CONNECTING"}</span>
          <span>ARC L1: 5042002</span>
          <span>LATENCY: {rpcLatencyMs !== null ? `${rpcLatencyMs}ms` : "PULLING"}</span>
        </div>
      </footer>
    </div>
  );
}
