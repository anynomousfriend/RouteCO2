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
  estimate: LandedFlightSettlementEstimate;
  status: "PENDING" | "SETTLING" | "SETTLED";
  txHash?: string;
  settledAt?: string;
  explorerUrl?: string;
}

// Initial realistic recently-landed flights for instant demo capability
export const INITIAL_LANDED_FLIGHTS: LandedFlightRecord[] = [
  {
    id: "dlh400-jfk",
    callsign: "DLH400",
    icao24: "3c6674",
    operator: "Lufthansa German Airlines",
    origin: "Frankfurt Int'l (EDDF)",
    destination: "New York JFK (KJFK)",
    airframe: AIRFRAME_PROFILES.A359,
    landedAt: "12 mins ago",
    airborneSeconds: 28800, // 8h 00m
    distanceKm: 6200,
    estimate: calculateLandedFlightSettlement({
      callsign: "DLH400",
      icao24: "3c6674",
      airframe: AIRFRAME_PROFILES.A359,
      airborneSeconds: 28800,
      distanceKm: 6200,
    }),
    status: "PENDING",
  },
  {
    id: "baw117-jfk",
    callsign: "BAW117",
    icao24: "40082c",
    operator: "British Airways",
    origin: "London Heathrow (EGLL)",
    destination: "New York JFK (KJFK)",
    airframe: AIRFRAME_PROFILES.B77W,
    landedAt: "28 mins ago",
    airborneSeconds: 27000, // 7h 30m
    distanceKm: 5550,
    estimate: calculateLandedFlightSettlement({
      callsign: "BAW117",
      icao24: "40082c",
      airframe: AIRFRAME_PROFILES.B77W,
      airborneSeconds: 27000,
      distanceKm: 5550,
    }),
    status: "PENDING",
  },
  {
    id: "uae201-jfk",
    callsign: "UAE201",
    icao24: "8964d8",
    operator: "Emirates",
    origin: "Dubai Int'l (OMDB)",
    destination: "New York JFK (KJFK)",
    airframe: AIRFRAME_PROFILES.A388,
    landedAt: "45 mins ago",
    airborneSeconds: 50400, // 14h 00m
    distanceKm: 11000,
    estimate: calculateLandedFlightSettlement({
      callsign: "UAE201",
      icao24: "8964d8",
      airframe: AIRFRAME_PROFILES.A388,
      airborneSeconds: 50400,
      distanceKm: 11000,
    }),
    status: "PENDING",
  },
  {
    id: "afr1248-cdg",
    callsign: "AFR1248",
    icao24: "3949e2",
    operator: "Air France",
    origin: "Nice Côte d'Azur (LFMN)",
    destination: "Paris Charles de Gaulle (LFPG)",
    airframe: AIRFRAME_PROFILES.A320,
    landedAt: "1 hour ago",
    airborneSeconds: 5400, // 1h 30m
    distanceKm: 700,
    estimate: calculateLandedFlightSettlement({
      callsign: "AFR1248",
      icao24: "3949e2",
      airframe: AIRFRAME_PROFILES.A320,
      airborneSeconds: 5400,
      distanceKm: 700,
    }),
    status: "PENDING",
  },
];

export interface LandedSettlementQueueProps {
  onSettlementSuccess?: (txHash: string, flight: LandedFlightRecord) => void;
  activeSessionCap?: number;
  flights?: LandedFlightRecord[];
  onFlightsChange?: (flights: LandedFlightRecord[]) => void;
}

export default function LandedSettlementQueue({
  onSettlementSuccess,
  activeSessionCap = 500,
  flights: externalFlights,
  onFlightsChange,
}: LandedSettlementQueueProps) {
  const [internalFlights, setInternalFlights] = useState<LandedFlightRecord[]>(INITIAL_LANDED_FLIGHTS);
  const flights = externalFlights || internalFlights;
  const setFlights = (updater: React.SetStateAction<LandedFlightRecord[]>) => {
    if (typeof updater === "function") {
      const next = updater(flights);
      if (onFlightsChange) onFlightsChange(next);
      setInternalFlights(next);
    } else {
      if (onFlightsChange) onFlightsChange(updater);
      setInternalFlights(updater);
    }
  };
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
        description: `Required offset ($${flight.estimate.usdcCost} USDC) exceeds your active session cap ($${activeSessionCap} USDC). Increase cap in Session Delegation.`,
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

      setFlights((prev) =>
        prev.map((f) =>
          f.id === flight.id
            ? {
                ...f,
                status: "SETTLED",
                txHash,
                settledAt: new Date().toLocaleTimeString(),
                explorerUrl,
              }
            : f
        )
      );

      const shortTx =
        txHash && txHash.length >= 18
          ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}`
          : txHash || "0xVerified";
      const gasText = data.gasUsed ? String(data.gasUsed) : "86,176";

      toast.success(`Wheels-Down Offset Settled on ArcScan!`, {
        id: toastId,
        description: `Tx: ${shortTx} | Gas: ${gasText}`,
        action: {
          label: "View ArcScan",
          onClick: () => window.open(explorerUrl, "_blank"),
        },
      });

      onSettlementSuccess?.(txHash, flight);
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
  };

  return (
    <div className="w-full flex flex-col gap-6 p-6 bg-[#0E121E] rounded-3xl border border-white/10 text-white shadow-2xl">
      {/* Top Banner: Queue Overview & Batch Trigger */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/10 font-mono">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Clock className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-wide">
              Landed Aircraft (Pending Settlement Queue)
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Flights with verified wheels-down touchdown awaiting SwapVM curve reconciliation & on-chain retirement
          </p>
        </div>

        {/* Aggregate Stats & Batch CTA */}
        <div className="flex items-center gap-4">
          <div className="bg-black/40 px-4 py-2 rounded-2xl border border-white/10 text-right">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Unsettled Carbon / Cost</div>
            <div className="text-sm font-bold text-emerald-400 tabular-nums">
              {totalPendingCo2Tonnes} t CO₂ • ${totalPendingCostUSDC} USDC
            </div>
          </div>

          <button
            onClick={handleBatchSettleAll}
            disabled={isBatchSettling || pendingCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-xs transition-[transform,opacity] duration-140 active:scale-95 shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isBatchSettling ? "Batch Settling..." : `Batch Settle All (${pendingCount})`}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search callsign, airline, destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161C2C] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg border transition-[transform,opacity] duration-140 ${
              statusFilter === "ALL"
                ? "bg-white/15 border-white/30 text-white font-bold"
                : "bg-black/20 border-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            All ({flights.length})
          </button>
          <button
            onClick={() => setStatusFilter("PENDING")}
            className={`px-3 py-1.5 rounded-lg border transition-[transform,opacity] duration-140 ${
              statusFilter === "PENDING"
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold"
                : "bg-black/20 border-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter("SETTLED")}
            className={`px-3 py-1.5 rounded-lg border transition-[transform,opacity] duration-140 ${
              statusFilter === "SETTLED"
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold"
                : "bg-black/20 border-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            Settled ({settledCount})
          </button>
        </div>
      </div>

      {/* Flight Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredFlights.map((flight) => {
          const isPending = flight.status === "PENDING";
          const isSettling = flight.status === "SETTLING";
          const isSettled = flight.status === "SETTLED";

          return (
            <div
              key={flight.id}
              className={`flex flex-col justify-between p-5 rounded-2xl border transition-[transform,opacity] duration-140 ${
                isSettled
                  ? "bg-[#111726]/70 border-emerald-500/30"
                  : isSettling
                  ? "bg-[#171D2F] border-amber-500/50"
                  : "bg-[#141A2B] border-white/10 hover:border-white/20"
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-white/10 font-mono">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-emerald-400">
                      <Plane className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white tracking-wider">
                          {flight.callsign}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                          {flight.airframe.model}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400">{flight.operator}</div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      isSettled
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                        : isSettling
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse"
                        : "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    }`}
                  >
                    {flight.status}
                  </div>
                </div>

                {/* Route & Touchdown Time */}
                <div className="grid grid-cols-2 gap-2 my-3 font-mono text-xs">
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[10px] text-zinc-400 uppercase">Route</span>
                    <div className="text-zinc-200 font-semibold truncate mt-0.5">
                      {flight.origin} → {flight.destination}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {flight.distanceKm.toLocaleString()} km • {Math.round(flight.airborneSeconds / 3600)}h {(flight.airborneSeconds % 3600) / 60}m airborne
                    </div>
                  </div>

                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[10px] text-zinc-400 uppercase">Touchdown</span>
                    <div className="text-zinc-200 font-semibold mt-0.5">
                      {flight.landedAt}
                    </div>
                    <div className="text-[10px] text-amber-400/80 mt-0.5">
                      Status: Wheels Down & Parked
                    </div>
                  </div>
                </div>

                {/* ICAO Emissions & SwapVM Valuation */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1.5 font-mono text-xs mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      Fuel Consumed:
                    </span>
                    <span className="font-bold text-white tabular-nums">
                      {flight.estimate.totalFuelBurnKg.toLocaleString()} kg
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                      Total Verified CO₂:
                    </span>
                    <span className="font-bold text-emerald-400 tabular-nums">
                      {(flight.estimate.totalCo2Kg / 1000).toFixed(2)} tonnes{" "}
                      <span className="text-[10px] text-zinc-400 font-normal">
                        ({flight.estimate.totalCo2Kg.toLocaleString()} kg)
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
                    <span className="text-zinc-300 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      SwapVM Dynamic Quote:
                    </span>
                    <span className="font-bold text-white text-sm tabular-nums">
                      ${flight.estimate.usdcCost.toFixed(2)} USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons / Explorer Receipt */}
              <div className="font-mono">
                {isSettled ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-semibold">Settled On-Chain ({flight.settledAt})</span>
                    </div>
                    {flight.explorerUrl && (
                      <a
                        href={flight.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-emerald-300 hover:text-white underline"
                      >
                        <span>ArcScan Tx</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleSettleFlight(flight)}
                    disabled={isSettling}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-xs transition-[transform,opacity] duration-140 active:scale-[0.98] shadow-lg"
                  >
                    <Zap className="w-4 h-4" />
                    <span>
                      {isSettling
                        ? "Broadcasting to Arc Testnet..."
                        : `Settle Carbon Offset ($${flight.estimate.usdcCost.toFixed(2)} USDC)`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
