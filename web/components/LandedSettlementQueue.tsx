"use client";

import React, { useState } from "react";
import {
  Plane,
  CheckCircle2,
  Clock,
  Flame,
  Leaf,
  Coins,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight,
  Filter,
  Search,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  AirframeProfile,
  AIRFRAME_PROFILES,
  calculateLandedFlightSettlement,
  LandedFlightSettlementEstimate,
} from "@/lib/icao-precision";
import {
  getStoredSettledFlights,
  saveStoredSettledFlight,
  mergeWithStoredSettled,
} from "@/lib/settled-storage";

export interface LandedFlightRecord {
  id: string;
  callsign: string;
  icao24: string;
  operator: string;
  origin: string;
  destination: string;
  airframe: AirframeProfile;
  landedAt: string; // ISO string or relative time
  airborneSeconds: number;
  distanceKm: number;
  /** Category-heuristic estimate flag (see /api/landed-flights estimationMethod) */
  estimatedAirborne?: boolean;
  estimationMethod?: string;
  estimate: LandedFlightSettlementEstimate;
  status: "PENDING" | "SETTLING" | "SETTLED";
  txHash?: string;
  settledAt?: string;
  explorerUrl?: string;
}

// Live ADS-B Ground Transponder Telemetry (Zero-Mock: dynamically populated from airport receivers)
export const INITIAL_LANDED_FLIGHTS: LandedFlightRecord[] = [];

export interface LandedSettlementQueueProps {
  onSettlementSuccess?: (txHash: string, flight: LandedFlightRecord) => void;
  activeSessionCap?: number;
  onOpenSessionModal?: () => void;
  flights?: LandedFlightRecord[];
  onFlightsChange?:
    | React.Dispatch<React.SetStateAction<LandedFlightRecord[]>>
    | ((flights: LandedFlightRecord[]) => void);
}

export default function LandedSettlementQueue({
  onSettlementSuccess,
  activeSessionCap = 5000,
  onOpenSessionModal,
  flights: externalFlights,
  onFlightsChange,
}: LandedSettlementQueueProps) {
  const [internalFlights, setInternalFlights] = useState<LandedFlightRecord[]>([]);
  const [isLoadingLanded, setIsLoadingLanded] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const flights = externalFlights !== undefined ? externalFlights : internalFlights;
  const setFlights = (updater: React.SetStateAction<LandedFlightRecord[]>) => {
    if (onFlightsChange) {
      if (typeof updater === "function") {
        (onFlightsChange as React.Dispatch<React.SetStateAction<LandedFlightRecord[]>>)(updater);
      } else {
        onFlightsChange(updater);
      }
    }
    setInternalFlights(updater);
  };

  // Poll real landed aircraft from airport ADS-B ground receivers
  const fetchLiveLanded = async () => {
    try {
      setIsLoadingLanded(true);
      const res = await fetch("/api/landed-flights");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.flights) && data.flights.length > 0) {
        setFlights(() => mergeWithStoredSettled(data.flights));
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.warn("Live landed radar poll notice:", err);
    } finally {
      setIsLoadingLanded(false);
    }
  };

  React.useEffect(() => {
    // Initial hydration from persistent storage
    const stored = getStoredSettledFlights();
    if (stored.length > 0) {
      setFlights((prev) => mergeWithStoredSettled(prev));
    }
    fetchLiveLanded();
    const interval = setInterval(fetchLiveLanded, 25000);
    return () => clearInterval(interval);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "SETTLED">("ALL");
  const [isBatchSettling, setIsBatchSettling] = useState(false);

  // Filtered list
  const filteredFlights = flights.filter((f) => {
    const matchesSearch =
      f.callsign.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.destination.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === "ALL") return matchesSearch;
    return matchesSearch && f.status === statusFilter;
  });

  const pendingCount = flights.filter((f) => f.status === "PENDING").length;
  const settledCount = flights.filter((f) => f.status === "SETTLED").length;

  const totalPendingCo2Tonnes = (
    flights
      .filter((f) => f.status === "PENDING")
      .reduce((acc, curr) => acc + curr.estimate.totalCo2Kg, 0) / 1000
  ).toFixed(2);

  const totalPendingCostUSDC = flights
    .filter((f) => f.status === "PENDING")
    .reduce((acc, curr) => acc + curr.estimate.usdcCost, 0)
    .toFixed(2);

  // Execute on-chain settlement on Arc Testnet via /api/settle
  const handleSettleFlight = async (flight: LandedFlightRecord) => {
    // Budget check against active session cap
    if (flight.estimate.usdcCost > activeSessionCap) {
      toast.error("Delegated Session Budget Exceeded", {
        description: `Required offset ($${flight.estimate.usdcCost.toLocaleString()} USDC) exceeds your active session cap ($${activeSessionCap.toLocaleString()} USDC). Increase cap in Session Delegation.`,
        action: onOpenSessionModal
          ? {
              label: "Increase Cap",
              onClick: () => onOpenSessionModal(),
            }
          : undefined,
      });
      return;
    }

    setFlights((prev) =>
      prev.map((f) => (f.id === flight.id ? { ...f, status: "SETTLING" } : f))
    );

    const toastId = toast.loading(`Broadcasting SwapVM Settlement for ${flight.callsign}...`, {
      description: `Retiring ${flight.estimate.totalCo2Kg.toLocaleString()} kg verified CO2 via Arc Testnet (5042002)`,
    });

    try {
      const res = await fetch("/api/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callsign: flight.callsign,
          aircraftCategory: flight.airframe.category,
          category: flight.airframe.category,
          airborneSeconds: flight.airborneSeconds,
          fuelBurnKg: flight.estimate.totalFuelBurnKg,
          co2Kg: flight.estimate.totalCo2Kg,
          usdcAmount: flight.estimate.usdcAmountMicro.toString(),
          swapVmBytecode: flight.estimate.swapVmBytecode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Settlement broadcast failed");
      }

      const txHash: string =
        data.settleTxHash ||
        data.settlementTxHash ||
        data.registerTxHash ||
        data.manifestTxHash ||
        "";
      const explorerUrl: string =
        data.explorerUrl ||
        (txHash ? `https://testnet.arcscan.app/tx/${txHash}` : "https://testnet.arcscan.app");

      const settledRecord: LandedFlightRecord = {
        ...flight,
        status: "SETTLED",
        txHash,
        settledAt: new Date().toLocaleTimeString(),
        explorerUrl,
      };

      // 1. Persist immediately to localStorage
      saveStoredSettledFlight(settledRecord);

      // 2. Update state
      setFlights((prev) =>
        prev.map((f) => (f.id === flight.id ? settledRecord : f))
      );

      const shortTx =
        txHash && txHash.length >= 18
          ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}`
          : txHash || "—";
      const gasText = data.gasUsed ? String(data.gasUsed) : "—";

      toast.success(`Wheels-Down Offset Settled on ArcScan!`, {
        id: toastId,
        description: `Tx: ${shortTx} | Gas: ${gasText}`,
        action: {
          label: "View in Settled",
          onClick: () => setStatusFilter("SETTLED"),
        },
      });

      onSettlementSuccess?.(txHash, settledRecord);
    } catch (err: any) {
      console.error("[LandedSettlement] Error:", err);
      setFlights((prev) =>
        prev.map((f) => (f.id === flight.id ? { ...f, status: "PENDING" } : f))
      );
      toast.error("Settlement Broadcast Reverted", {
        id: toastId,
        description: err.message || "Failed to communicate with Arc Testnet RPC",
      });
    }
  };

  // Batch settle all pending landed flights
  const handleBatchSettleAll = async () => {
    const pendingList = flights.filter((f) => f.status === "PENDING");
    if (pendingList.length === 0) {
      toast.info("No pending landed flights to settle");
      return;
    }

    setIsBatchSettling(true);
    toast.info(`Initiating batch settlement for ${pendingList.length} flights...`);

    for (const flight of pendingList) {
      await handleSettleFlight(flight);
    }
    setIsBatchSettling(false);
    setStatusFilter("SETTLED");
  };

  return (
    <div className="w-full flex flex-col gap-5 p-6 bg-[#272e33] border border-dashed border-[#d3c6aa]/16 text-[#d3c6aa] font-mono">
      {/* ── Tier 1: Command Header (Single-line horizontal alignment) ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-dashed border-[#d3c6aa]/16 font-mono">
        {/* Left: Icon, Title & Live Radar Status */}
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-[#a7c080]/10 border border-dashed border-[#a7c080]/40 text-[#a7c080] shrink-0">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-[#d3c6aa] tracking-wide font-mono uppercase">
                Landed Aircraft Operations
              </h2>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#a7c080]/15 border border-dashed border-[#a7c080]/40 text-[#a7c080] text-[11px] font-mono font-medium">
                <span className="w-1.5 h-1.5 bg-[#a7c080] blink-step" />
                <span>Live ADS-B Ground Radar</span>
              </div>
            </div>
            <p className="text-xs text-[#859289] font-mono mt-0.5">
              Verified commercial arrivals on airport tarmac · EDDF · LFPG · EGLL · EHAM
              {lastSyncTime && <span className="ml-2 text-[#859289]/70">· Synced {lastSyncTime}</span>}
            </p>
          </div>
        </div>

        {/* Right: Unified Action Row (Strictly aligned h-10 controls, no staircase) */}
        <div className="flex items-center gap-2.5 flex-wrap self-stretch lg:self-auto justify-end">
          <button
            onClick={fetchLiveLanded}
            disabled={isLoadingLanded}
            className="h-10 px-3.5 bg-[#2d353b] hover:bg-[#343f44] border border-dashed border-[#d3c6aa]/16 text-[#9daaa4] hover:text-[#d3c6aa] flex items-center gap-2 text-xs font-mono transition-colors disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            title="Refresh Live Ground Radar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLanded ? "animate-spin text-[#a7c080]" : ""}`} />
            <span>Scan Radar</span>
          </button>

          <div className="h-10 px-3.5 bg-[#2d353b] border border-dashed border-[#d3c6aa]/16 flex items-center gap-2 font-mono text-xs">
            <ShieldCheck className="w-4 h-4 text-[#dbbc7f] shrink-0" />
            <span className="text-[#859289]">Cap:</span>
            <span className="font-bold text-[#d3c6aa] tabular-nums">${activeSessionCap.toLocaleString()} USDC</span>
            {onOpenSessionModal && (
              <button
                onClick={onOpenSessionModal}
                className="ml-1 px-1.5 py-0.5 bg-[#dbbc7f]/20 hover:bg-[#dbbc7f]/30 text-[#dbbc7f] hover:text-[#dbbc7f] text-[10px] font-mono border border-dashed border-[#dbbc7f]/40 transition-colors cursor-pointer"
              >
                Adjust
              </button>
            )}
          </div>

          <button
            onClick={handleBatchSettleAll}
            disabled={isBatchSettling || pendingCount === 0}
            className="h-10 flex items-center gap-2 px-4 bg-[#a7c080] hover:bg-[#dbbc7f] disabled:opacity-40 disabled:cursor-not-allowed text-[#2d353b] font-bold text-xs font-mono transition-[transform,opacity] duration-140 active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isBatchSettling ? "Settling..." : `Batch Settle All (${pendingCount})`}</span>
          </button>
        </div>
      </div>

      {/* ── Tier 2: 3-Card Bento Metric Ribbon ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 font-mono">
        {/* Card 1: Queue Volume */}
        <div className="p-4 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 flex flex-col justify-between hover:border-[#d3c6aa]/35 transition-colors">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#9daaa4]">
              Aircraft In Queue
            </span>
            <Plane className="w-4 h-4 text-[#859289]" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#d3c6aa] tabular-nums tracking-tight">
              {flights.length} <span className="text-sm font-normal text-[#859289]">Arrivals</span>
            </div>
            <div className="text-xs text-[#859289] mt-1 flex items-center gap-2">
              <span className="text-[#dbbc7f] font-medium">{pendingCount} Pending</span>
              <span className="text-[#859289]/50">·</span>
              <span className="text-[#a7c080] font-medium">{settledCount} Settled</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Pending Carbon Liability */}
        <div className="p-4 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 flex flex-col justify-between hover:border-[#a7c080]/40 transition-colors">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#9daaa4]">
              Pending Carbon Liability
            </span>
            <Leaf className="w-4 h-4 text-[#a7c080]" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#a7c080] tabular-nums tracking-tight">
              {totalPendingCo2Tonnes} <span className="text-sm font-normal text-[#a7c080]/70">t CO₂</span>
            </div>
            <div className="text-xs text-[#859289] mt-1">
              ICAO Multi-Tier Burn Calculation
            </div>
          </div>
        </div>

        {/* Card 3: SwapVM Dynamic Offset Cost */}
        <div className="p-4 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 flex flex-col justify-between hover:border-[#dbbc7f]/40 transition-colors">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#9daaa4]">
              SwapVM Offset Cost
            </span>
            <Coins className="w-4 h-4 text-[#dbbc7f]" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#d3c6aa] tabular-nums tracking-tight">
              ${totalPendingCostUSDC} <span className="text-sm font-normal text-[#859289]">USDC</span>
            </div>
            <div className="text-xs text-[#859289] mt-1">
              Sub-second Arc Testnet Settlement Ready
            </div>
          </div>
        </div>
      </div>

      {/* ── Tier 3: Filter & Search Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#859289] pointer-events-none" />
          <input
            type="text"
            placeholder="Search callsign, airline, destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 pl-9 pr-3 py-2 text-[#d3c6aa] placeholder-[#859289] focus:outline-none focus:border-[#a7c080]/50 transition-colors"
          />
        </div>

        <div className="flex items-center p-1 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 text-xs font-mono transition-[transform,opacity,background-color] duration-140 cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-[#d3c6aa] text-[#2d353b] font-semibold"
                : "text-[#859289] hover:text-[#d3c6aa]"
            }`}
          >
            All ({flights.length})
          </button>
          <button
            onClick={() => setStatusFilter("PENDING")}
            className={`px-3 py-1.5 text-xs font-mono transition-[transform,opacity,background-color] duration-140 cursor-pointer ${
              statusFilter === "PENDING"
                ? "bg-[#dbbc7f]/20 text-[#dbbc7f] font-semibold"
                : "text-[#859289] hover:text-[#d3c6aa]"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter("SETTLED")}
            className={`px-3 py-1.5 text-xs font-mono transition-[transform,opacity,background-color] duration-140 cursor-pointer ${
              statusFilter === "SETTLED"
                ? "bg-[#a7c080]/20 text-[#a7c080] font-semibold"
                : "text-[#859289] hover:text-[#d3c6aa]"
            }`}
          >
            Settled ({settledCount})
          </button>
        </div>
      </div>

      {/* ── Flight Cards Grid or Empty State ── */}
      {filteredFlights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#1e2528]/60 border border-dashed border-[#d3c6aa]/[0.08] text-center font-mono">
          {isLoadingLanded ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#a7c080]/30 border-t-[#a7c080] animate-spin" />
              <div className="text-sm font-semibold text-[#9daaa4]">
                Scanning Airport Surface ADS-B Receivers...
              </div>
              <div className="text-xs text-[#859289]">
                Querying live wheels-down aircraft at Frankfurt (EDDF), Paris (LFPG), London (EGLL)
              </div>
            </div>
          ) : statusFilter === "SETTLED" ? (
            <div className="flex flex-col items-center gap-2 max-w-sm">
              <div className="w-10 h-10 bg-[#a7c080]/10 border border-dashed border-[#a7c080]/30 flex items-center justify-center text-[#a7c080] mb-1">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold text-[#9daaa4]">
                No Settled Aircraft Yet
              </div>
              <div className="text-xs text-[#859289] leading-relaxed">
                When you settle aircraft from the pending queue, their verified ArcScan transaction receipts will be archived and displayed here.
              </div>
              {pendingCount > 0 && (
                <button
                  onClick={() => setStatusFilter("PENDING")}
                  className="mt-3 px-3.5 py-1.5 bg-[#a7c080]/20 hover:bg-[#a7c080]/30 text-[#a7c080] border border-dashed border-[#a7c080]/40 text-xs cursor-pointer transition-colors font-mono"
                >
                  View Pending Queue ({pendingCount})
                </button>
              )}
            </div>
          ) : statusFilter === "PENDING" && flights.length > 0 ? (
            <div className="flex flex-col items-center gap-2 max-w-sm">
              <div className="w-10 h-10 bg-[#a7c080]/10 border border-dashed border-[#a7c080]/30 flex items-center justify-center text-[#a7c080] mb-1">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold text-[#9daaa4]">
                All Landed Aircraft Settled!
              </div>
              <div className="text-xs text-[#859289] leading-relaxed">
                Every arrival in the surface queue has been verified and retired on Arc Testnet.
              </div>
              <button
                onClick={() => setStatusFilter("SETTLED")}
                className="mt-3 px-3.5 py-1.5 bg-[#d3c6aa]/10 hover:bg-[#d3c6aa]/20 text-xs text-[#d3c6aa] cursor-pointer transition-colors font-mono border border-dashed border-[#d3c6aa]/16"
              >
                View Settled Receipts ({settledCount})
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Plane className="w-8 h-8 text-[#859289]/60 mb-1" />
              <div className="text-sm font-semibold text-[#9daaa4]">
                No Landed Aircraft Matching Filter
              </div>
              <div className="text-xs text-[#859289]">
                Click scan to poll active airport ground transponders across European hubs
              </div>
              <button
                onClick={fetchLiveLanded}
                className="mt-3 px-3.5 py-1.5 bg-[#d3c6aa]/10 hover:bg-[#d3c6aa]/20 text-xs text-[#d3c6aa] cursor-pointer transition-colors font-mono border border-dashed border-[#d3c6aa]/16"
              >
                Scan Surface Radar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredFlights.map((flight) => {
          const isPending = flight.status === "PENDING";
          const isSettling = flight.status === "SETTLING";
          const isSettled = flight.status === "SETTLED";

          return (
            <div
              key={flight.id}
              className={`flex flex-col justify-between p-5 border transition-[transform,opacity] duration-140 ${
                isSettled
                  ? "bg-[#1e2528]/70 border-dashed border-[#a7c080]/40"
                  : isSettling
                  ? "bg-[#1e2528] border-dashed border-[#dbbc7f]/50"
                  : "bg-[#1e2528] border-dashed border-[#d3c6aa]/16 hover:border-[#d3c6aa]/35"
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-dashed border-[#d3c6aa]/16 font-mono">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#d3c6aa]/5 border border-dashed border-[#d3c6aa]/16 text-[#a7c080]">
                      <Plane className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-[#d3c6aa] tracking-wider">
                          {flight.callsign}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-[#d3c6aa]/10 text-[#9daaa4]">
                          {flight.airframe.model}
                        </span>
                      </div>
                      <div className="text-xs text-[#859289]">{flight.operator}</div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border-dashed ${
                      isSettled
                        ? "bg-[#a7c080]/20 border-[#a7c080]/50 text-[#a7c080]"
                        : isSettling
                        ? "bg-[#dbbc7f]/20 border-[#dbbc7f]/50 text-[#dbbc7f] blink-step"
                        : "bg-[#dbbc7f]/15 border-[#dbbc7f]/30 text-[#dbbc7f]"
                    }`}
                  >
                    {flight.status}
                  </div>
                </div>

                {/* Route & Touchdown Time */}
                <div className="grid grid-cols-2 gap-2 my-3 font-mono text-xs">
                  <div className="bg-[#2d353b]/60 p-2.5 border border-dashed border-[#d3c6aa]/[0.08]">
                    <span className="text-[10px] text-[#859289] uppercase">Route</span>
                    <div className="text-[#d3c6aa] font-semibold truncate mt-0.5">
                      {flight.origin} → {flight.destination}
                    </div>
                    <div className="text-[10px] text-[#859289] mt-0.5">
                      {flight.distanceKm.toLocaleString()} km • {Math.round(flight.airborneSeconds / 3600)}h {(flight.airborneSeconds % 3600) / 60}m airborne
                    </div>
                  </div>

                  <div className="bg-[#2d353b]/60 p-2.5 border border-dashed border-[#d3c6aa]/[0.08]">
                    <span className="text-[10px] text-[#859289] uppercase">Touchdown</span>
                    <div className="text-[#d3c6aa] font-semibold mt-0.5">
                      {flight.landedAt}
                    </div>
                    <div className="text-[10px] text-[#dbbc7f]/80 mt-0.5">
                      Status: Wheels Down & Parked
                    </div>
                  </div>
                </div>

                {/* ICAO Emissions & SwapVM Valuation */}
                <div className="p-3 bg-[#2d353b]/80 border border-dashed border-[#d3c6aa]/[0.08] flex flex-col gap-1.5 font-mono text-xs mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#859289] flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-[#e69875]" />
                      Fuel Consumed:
                    </span>
                    <span className="font-bold text-[#d3c6aa] tabular-nums">
                      {flight.estimate.totalFuelBurnKg.toLocaleString()} kg
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#859289] flex items-center gap-1.5">
                      <Leaf className="w-3.5 h-3.5 text-[#a7c080]" />
                      Total Verified CO₂:
                    </span>
                    <span className="font-bold text-[#a7c080] tabular-nums">
                      {(flight.estimate.totalCo2Kg / 1000).toFixed(2)} tonnes{" "}
                      <span className="text-[10px] text-[#859289] font-normal">
                        ({flight.estimate.totalCo2Kg.toLocaleString()} kg)
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-dashed border-[#d3c6aa]/16">
                    <span className="text-[#9daaa4] flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-[#dbbc7f]" />
                      SwapVM Dynamic Quote:
                    </span>
                    <span className="font-bold text-[#d3c6aa] text-sm tabular-nums">
                      ${flight.estimate.usdcCost.toFixed(2)} USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons / Explorer Receipt */}
              <div className="font-mono">
                {isSettled ? (
                  <div className="flex items-center justify-between p-3 bg-[#a7c080]/[0.08] border border-dashed border-[#a7c080]/30 text-xs">
                    <div className="flex items-center gap-2 text-[#a7c080]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="font-semibold">
                        Settled On-Chain {flight.settledAt ? `(${flight.settledAt})` : ""}
                      </span>
                    </div>
                    {flight.explorerUrl && (
                      <a
                        href={flight.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-[#a7c080] hover:text-[#d3c6aa] underline"
                      >
                        <span>ArcScan Tx</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ) : (
                  <>
                    {flight.estimate.usdcCost > activeSessionCap && (
                      <div className="flex items-center justify-between px-3 py-1.5 bg-[#dbbc7f]/10 border border-dashed border-[#dbbc7f]/30 text-[#dbbc7f] text-[11px] mb-2 font-mono">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#dbbc7f] shrink-0" />
                          <span>Exceeds cap (${activeSessionCap.toLocaleString()} USDC)</span>
                        </div>
                        {onOpenSessionModal && (
                          <button
                            onClick={onOpenSessionModal}
                            className="underline hover:text-[#d3c6aa] font-semibold text-[#dbbc7f] cursor-pointer text-[10px]"
                          >
                            Increase Cap →
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => handleSettleFlight(flight)}
                      disabled={isSettling}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#a7c080] hover:bg-[#dbbc7f] disabled:opacity-50 text-[#2d353b] font-bold text-xs transition-[transform,opacity] duration-140 active:scale-[0.98] cursor-pointer font-mono"
                    >
                      <Zap className="w-4 h-4" />
                      <span>
                        {isSettling
                          ? "Broadcasting to Arc Testnet..."
                          : `Settle Carbon Offset ($${flight.estimate.usdcCost.toFixed(2)} USDC)`}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
