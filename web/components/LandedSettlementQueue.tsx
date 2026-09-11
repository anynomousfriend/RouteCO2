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
  Radio,
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
  /** Recorded-path card: direct settle disabled, replay-first flow. */
  recordingAttached?: boolean;
  status: "PENDING" | "SETTLING" | "SETTLED" | "WATCHING";
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
  /** Callsign currently armed for auto-settle on touchdown (renders a WATCHING row). */
  armedCallsign?: string | null;
  onDisarm?: () => void;
  /** Treasury checked by the pre-flight spend guard before broadcasting. */
  treasuryAddress?: string;
  /** Currently selected radar callsign (drives the Mine filter). */
  selectedCallsign?: string;
  /** Replay-first flow for recorded-path cards (track id === record id). */
  onReplayRecording?: (trackId: string) => void;
  /** Visitor testnet key (memory-only): settle signs locally instead of the server route. */
  byokKey?: `0x${string}` | null;
}

export default function LandedSettlementQueue({
  onSettlementSuccess,
  activeSessionCap = 5000,
  onOpenSessionModal,
  flights: externalFlights,
  onFlightsChange,
  armedCallsign = null,
  onDisarm,
  treasuryAddress,
  selectedCallsign,
  onReplayRecording,
  byokKey = null,
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

  // Batch selection state for selecting multiple carbon credit settlements
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const toggleBatchSelect = (id: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Two-step real-spend confirm: first click arms, second click (within 8s) broadcasts.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);
  const CONFIRM_THRESHOLD_USDC = 5;

  // Synthetic WATCHING row for the armed flight (render-only, never persisted).
  const armedKey = (armedCallsign || "").toLowerCase();
  const armedAlreadyListed = armedKey
    ? flights.some(
        (f) =>
          f.callsign.toLowerCase() === armedKey ||
          (f.icao24 && f.icao24.toLowerCase() === armedKey)
      )
    : false;
  const watchRow: LandedFlightRecord | null =
    armedKey && !armedAlreadyListed
      ? {
          id: `watch-${armedKey}`,
          callsign: armedKey.toUpperCase(),
          icao24: /^[0-9a-f]{6}$/.test(armedKey) ? armedKey : "",
          operator: "Live Radar Watch",
          origin: "En-route",
          destination: "Awaiting touchdown",
          airframe: AIRFRAME_PROFILES.A320,
          landedAt: "Watching…",
          airborneSeconds: 0,
          distanceKm: 0,
          estimatedAirborne: true,
          estimationMethod: "watch",
          estimate: {
            callsign: armedKey.toUpperCase(),
            icao24: "",
            airframe: AIRFRAME_PROFILES.A320,
            airborneSeconds: 0,
            totalFuelBurnKg: 0,
            totalCo2Kg: 0,
            usdcCost: 0,
            usdcAmountMicro: "0",
            swapVmBytecode: "0x01020304",
          },
          status: "WATCHING",
        }
      : null;
  const displayFlights = watchRow ? [watchRow, ...flights] : flights;

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
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "SETTLED" | "MINE">("ALL");
  const [isBatchSettling, setIsBatchSettling] = useState(false);

  const selectedKey = (selectedCallsign || "").toLowerCase();
  const isMine = (f: LandedFlightRecord) =>
    f.status === "WATCHING" ||
    (f.status === "SETTLED" && Boolean(f.txHash)) ||
    (selectedKey !== "" && f.callsign.toLowerCase() === selectedKey);

  // Filtered list
  const filteredFlights = displayFlights.filter((f) => {
    const matchesSearch =
      f.callsign.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.destination.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "ALL") return true;
    if (statusFilter === "MINE") return isMine(f);
    if (statusFilter === "PENDING") return f.status === "PENDING" || f.status === "WATCHING";
    return f.status === statusFilter;
  });

  const pendingCount = displayFlights.filter((f) => f.status === "PENDING").length;
  const watchingCount = displayFlights.filter((f) => f.status === "WATCHING").length;
  const settledCount = displayFlights.filter((f) => f.status === "SETTLED").length;
  const mineCount = displayFlights.filter(isMine).length;

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
    // Budget check against active session cap (server route only; BYOK spends own money)
    if (!byokKey && flight.estimate.usdcCost > activeSessionCap) {
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

    // Pre-flight treasury spend guard: verify real USDC covers the pull before broadcasting.
    if (treasuryAddress) {
      const { checkTreasuryFunds, insufficientFundsToast } = await import(
        "@/lib/treasury-guard"
      );
      const needed = BigInt(flight.estimate.usdcAmountMicro.toString());
      const check = await checkTreasuryFunds(treasuryAddress, needed);
      if (!check.ok) {
        const t = insufficientFundsToast(check, treasuryAddress);
        toast.error(t.title, {
          description: t.description,
          duration: t.duration,
          action: t.action,
        });
        return;
      }
    }

    setFlights((prev) =>
      prev.map((f) => (f.id === flight.id ? { ...f, status: "SETTLING" } : f))
    );

    const toastId = toast.loading(
      byokKey
        ? `Signing SwapVM Settlement locally for ${flight.callsign} (your key)...`
        : `Broadcasting SwapVM Settlement for ${flight.callsign}...`,
      {
        description: `Retiring ${flight.estimate.totalCo2Kg.toLocaleString()} kg verified CO2 via Arc Testnet (5042002)`,
      }
    );

    try {
      type QueueSettleData = {
        settleTxHash: string;
        settlementTxHash?: string;
        registerTxHash?: string;
        manifestTxHash?: string;
        explorerUrl: string;
        gasUsed?: string;
      };
      let data: QueueSettleData;
      if (byokKey) {
        // BYOK: four transactions signed locally in-browser; key never leaves this device.
        const { runByokSettlement } = await import("@/lib/byok-settler");
        const { SKYROUTE_VAULT_ADDRESS } = await import("@/lib/arc-client");
        const aquaAddress = process.env.NEXT_PUBLIC_AQUA_CORE_ADDRESS as `0x${string}`;
        const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
        if (!aquaAddress || !usdcAddress) {
          throw new Error("BYOK misconfigured: missing Aqua/USDC addresses.");
        }
        const STEP_LABELS: Record<string, string> = {
          register: "manifest registered",
          approve: "Aqua approved",
          ship: "strategy shipped",
          settle: "offset settled",
          verify: "receipt verified",
        };
        const result = await runByokSettlement(
          byokKey,
          {
            callsign: flight.callsign,
            aircraftCategory: flight.airframe.category,
            airborneSeconds: Math.floor(flight.airborneSeconds),
            fuelBurnKg: Math.floor(flight.estimate.totalFuelBurnKg),
            co2Kg: Math.floor(flight.estimate.totalCo2Kg),
            usdcAmountMicro: BigInt(flight.estimate.usdcAmountMicro.toString()),
            swapVmBytecode: flight.estimate.swapVmBytecode as `0x${string}`,
            vaultAddress: SKYROUTE_VAULT_ADDRESS,
            aquaAddress,
            usdcAddress,
          },
          (s) => {
            toast.loading(`BYOK: ${STEP_LABELS[s.step] || s.step}…`, { id: toastId });
          }
        );
        data = {
          settleTxHash: result.settleTxHash,
          explorerUrl: result.explorerUrl,
          gasUsed: result.gasUsed,
        };
      } else {
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

        data = await res.json();

        if (!res.ok || !(data as { success?: boolean }).success) {
          throw new Error((data as { error?: string }).error || "Settlement broadcast failed");
        }
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
          : txHash || "--";
      const gasText = data.gasUsed ? String(data.gasUsed) : "--";

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

  // Two-step real-spend confirm wrapper (first click arms, second broadcasts).
  const requestSettleFlight = (flight: LandedFlightRecord) => {
    if (flight.estimate.usdcCost < CONFIRM_THRESHOLD_USDC || confirmId === flight.id) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmId(null);
      void handleSettleFlight(flight);
      return;
    }
    setConfirmId(flight.id);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmId(null), 8000);
  };

  // Batch settle all pending landed flights (or only selected ones)
  const handleBatchSettleAll = async () => {
    const selectedPending = flights.filter(
      (f) => f.status === "PENDING" && (selectedBatchIds.size === 0 || selectedBatchIds.has(f.id))
    );
    if (selectedPending.length === 0) {
      toast.info("No pending landed flights to settle");
      return;
    }

    setIsBatchSettling(true);
    toast.info(`Initiating batch settlement for ${selectedPending.length} flights...`);

    for (const flight of selectedPending) {
      await handleSettleFlight(flight);
    }
    setIsBatchSettling(false);
    setSelectedBatchIds(new Set());
    setStatusFilter("SETTLED");
  };

  const batchTargetCount = selectedBatchIds.size > 0
    ? flights.filter((f) => f.status === "PENDING" && selectedBatchIds.has(f.id)).length
    : pendingCount;

  return (
    <div className="w-full flex flex-col gap-5 p-6 bg-[#D6D5CF] rounded-xl border border-[#D4D3CD] text-[#111111] font-sans">
      {/* ── Tier 1: Command Header (Single-line horizontal alignment) ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-[#D4D3CD] font-sans">
        {/* Left: Icon, Title & Live Radar Status */}
        <div className="flex items-center gap-3.5">
          <div className="icon-circle w-10 h-10 bg-[#ECEBE6] text-[#111111] border border-[#D4D3CD] shrink-0">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-[#111111] tracking-wide font-sans uppercase">
                Landed Aircraft Operations
              </h2>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#ECEBE6] border border-[#D4D3CD] rounded-full text-[#111111] text-[11px] font-mono font-medium">
                <span className="w-1.5 h-1.5 bg-[#FF4D00] blink-step rounded-full" />
                <span>Live ADS-B Ground Radar</span>
              </div>
            </div>
            <p className="text-xs text-[#555555] font-sans mt-1">
              Verified commercial arrivals on airport tarmac · EDDF · LFPG · EGLL · EHAM
              {lastSyncTime && <span className="ml-2 text-[#888888]">· Synced {lastSyncTime}</span>}
            </p>
            <p className="text-[10.5px] text-[#888888] font-sans mt-0.5">
              Aircraft are live radar contacts; durations, distances, and costs are
              category-heuristic estimates, not measured leg history.
            </p>
          </div>
        </div>

        {/* Right: Unified Action Row */}
        <div className="flex items-center gap-2.5 flex-wrap self-stretch lg:self-auto justify-end">
          <button
            onClick={fetchLiveLanded}
            disabled={isLoadingLanded}
            className="btn-pill h-10 px-4 bg-[#ECEBE6] hover:bg-[#ECEBE6]/80 border border-[#D4D3CD] text-[#111111] flex items-center gap-2 text-xs font-sans transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            title="Refresh Live Ground Radar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLanded ? "animate-spin text-[#FF4D00]" : ""}`} />
            <span>Scan Radar</span>
          </button>

          <div className="h-10 px-4 bg-[#ECEBE6] border border-[#D4D3CD] rounded-full flex items-center gap-2 font-sans text-xs">
            <ShieldCheck className="w-4 h-4 text-[#111111] shrink-0" />
            <span className="text-[#555555]">Cap:</span>
            <span className="font-mono font-bold text-[#111111] tabular-nums">${activeSessionCap.toLocaleString()} USDC</span>
            {onOpenSessionModal && (
              <button
                onClick={onOpenSessionModal}
                className="btn-pill ml-1 px-2 py-0.5 bg-[#D6D5CF] hover:bg-[#D4D3CD] text-[#111111] text-[10px] font-sans transition-colors cursor-pointer border border-[#D4D3CD]"
              >
                Adjust
              </button>
            )}
          </div>

          <button
            onClick={handleBatchSettleAll}
            disabled={isBatchSettling || batchTargetCount === 0}
            className="btn-pill h-10 flex items-center gap-2 px-5 bg-[#111111] hover:bg-[#FF4D00] disabled:opacity-40 disabled:cursor-not-allowed text-[#ECEBE6] font-bold text-xs font-sans transition-[transform,colors] duration-140 active:scale-[0.98] cursor-pointer shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isBatchSettling
                ? "Settling..."
                : selectedBatchIds.size > 0
                ? `Execute Batch Settlement (${batchTargetCount})`
                : `Batch Settle All (${pendingCount})`}
            </span>
          </button>
        </div>
      </div>

      {/* ── Tier 2: 3-Card Bento Metric Ribbon ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 font-sans">
        {/* Card 1: Queue Volume */}
        <div className="p-4 bg-[#ECEBE6] rounded-xl border border-[#D4D3CD] flex flex-col justify-between hover:border-[#111111] transition-colors">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#555555]">
              Aircraft In Queue
            </span>
            <Plane className="w-4 h-4 text-[#555555]" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-mono font-bold text-[#111111] tabular-nums tracking-tight">
              {flights.length} <span className="text-sm font-sans font-normal text-[#555555]">Arrivals</span>
            </div>
            <div className="text-xs font-sans text-[#555555] mt-1 flex items-center gap-2">
              <span className="font-semibold text-[#111111]">{pendingCount} Pending</span>
              <span className="text-[#D4D3CD]">·</span>
              <span className="font-medium text-[#555555]">{settledCount} Settled</span>
              {watchingCount > 0 && (
                <>
                  <span className="text-[#D4D3CD]">·</span>
                  <span className="text-[#FF4D00] font-medium">{watchingCount} Watching</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Total Pending Carbon Liability */}
        <div className="p-4 bg-[#ECEBE6] rounded-xl border border-[#D4D3CD] flex flex-col justify-between hover:border-[#111111] transition-colors">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#555555]">
              Pending Carbon Liability
            </span>
            <Leaf className="w-4 h-4 text-[#111111]" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-mono font-bold text-[#111111] tabular-nums tracking-tight">
              {totalPendingCo2Tonnes} <span className="text-sm font-mono font-normal text-[#555555]">t CO₂</span>
            </div>
            <div className="text-xs text-[#555555] mt-1">
              ICAO Multi-Tier Burn Calculation
            </div>
          </div>
        </div>

        {/* Card 3: SwapVM Dynamic Offset Cost */}
        <div className="p-4 bg-[#ECEBE6] rounded-xl border border-[#D4D3CD] flex flex-col justify-between hover:border-[#111111] transition-colors">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#555555]">
              SwapVM Offset Cost
            </span>
            <Coins className="w-4 h-4 text-[#111111]" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-mono font-bold text-[#111111] tabular-nums tracking-tight">
              ${totalPendingCostUSDC} <span className="text-sm font-mono font-normal text-[#555555]">USDC</span>
            </div>
            <div className="text-xs text-[#555555] mt-1">
              Sub-second Arc Testnet Settlement Ready
            </div>
          </div>
        </div>
      </div>

      {/* ── Tier 3: Filter & Search Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-sans text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555555] pointer-events-none" />
          <input
            type="text"
            placeholder="Search callsign, airline, destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#ECEBE6] border border-[#D4D3CD] rounded-full pl-9 pr-4 py-2 text-[#111111] placeholder-[#888888] focus:outline-none focus:border-[#111111] transition-colors text-xs font-sans"
          />
        </div>

        <div className="flex items-center p-1 bg-[#ECEBE6] rounded-full border border-[#D4D3CD] self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`btn-pill px-3 py-1.5 text-xs font-sans transition-colors cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-[#111111] text-[#ECEBE6] font-semibold"
                : "text-[#555555] hover:text-[#111111]"
            }`}
          >
            All ({flights.length})
          </button>
          <button
            onClick={() => setStatusFilter("PENDING")}
            className={`btn-pill px-3 py-1.5 text-xs font-sans transition-colors cursor-pointer ${
              statusFilter === "PENDING"
                ? "bg-[#111111] text-[#ECEBE6] font-semibold"
                : "text-[#555555] hover:text-[#111111]"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter("SETTLED")}
            className={`btn-pill px-3 py-1.5 text-xs font-sans transition-colors cursor-pointer ${
              statusFilter === "SETTLED"
                ? "bg-[#111111] text-[#ECEBE6] font-semibold"
                : "text-[#555555] hover:text-[#111111]"
            }`}
          >
            Settled ({settledCount})
          </button>
          <button
            onClick={() => setStatusFilter("MINE")}
            title="Flights settled from this console, armed watches, and the selected radar track"
            className={`btn-pill px-3 py-1.5 text-xs font-sans transition-colors cursor-pointer ${
              statusFilter === "MINE"
                ? "bg-[#FF4D00] text-white font-semibold"
                : "text-[#555555] hover:text-[#111111]"
            }`}
          >
            Mine ({mineCount})
          </button>
        </div>
      </div>

      {/* ── Flight Cards Grid, Bento Skeleton, or Empty State ── */}
      {isLoadingLanded ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="flex flex-col justify-between h-full p-5 rounded-xl border border-[#D4D3CD] bg-[#ECEBE6] animate-pulse shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
            >
              <div>
                {/* Header Skeleton */}
                <div className="flex items-start justify-between pb-3 border-b border-[#D4D3CD]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#D6D5CF]" />
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-4 rounded bg-[#D6D5CF]" />
                        <div className="w-12 h-3.5 rounded-full bg-[#D6D5CF]" />
                      </div>
                      <div className="w-24 h-3 rounded bg-[#D6D5CF] mt-1.5" />
                    </div>
                  </div>
                  <div className="w-14 h-4 rounded-full bg-[#D6D5CF]" />
                </div>

                {/* Route Skeleton */}
                <div className="py-4 flex items-center justify-between border-b border-[#D4D3CD]">
                  <div className="space-y-1">
                    <div className="w-12 h-5 rounded bg-[#D6D5CF]" />
                    <div className="w-16 h-3 rounded bg-[#D6D5CF]" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-24 h-1.5 rounded bg-[#D6D5CF]" />
                    <div className="w-10 h-2.5 rounded bg-[#D6D5CF]" />
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="w-12 h-5 rounded bg-[#D6D5CF] ml-auto" />
                    <div className="w-16 h-3 rounded bg-[#D6D5CF] ml-auto" />
                  </div>
                </div>

                {/* Metrics Skeleton */}
                <div className="grid grid-cols-3 gap-2 py-3">
                  <div className="p-2.5 rounded-lg bg-[#D6D5CF]/50 space-y-1">
                    <div className="w-10 h-2.5 rounded bg-[#D6D5CF]" />
                    <div className="w-14 h-4 rounded bg-[#D6D5CF]" />
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#D6D5CF]/50 space-y-1">
                    <div className="w-10 h-2.5 rounded bg-[#D6D5CF]" />
                    <div className="w-14 h-4 rounded bg-[#D6D5CF]" />
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#D6D5CF]/50 space-y-1">
                    <div className="w-10 h-2.5 rounded bg-[#D6D5CF]" />
                    <div className="w-14 h-4 rounded bg-[#D6D5CF]" />
                  </div>
                </div>
              </div>

              {/* Bottom Button Skeleton */}
              <div className="mt-auto pt-4 border-t border-[#D4D3CD]">
                <div className="w-full h-9 rounded-full bg-[#D6D5CF]" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredFlights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#ECEBE6] rounded-xl border border-[#D4D3CD] text-center font-sans">
          {statusFilter === "SETTLED" ? (
            <div className="flex flex-col items-center gap-2 max-w-sm">
              <div className="icon-circle w-10 h-10 text-[#FF4D00] mb-1">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold text-[#111111]">
                No Settled Aircraft Yet
              </div>
              <div className="text-xs text-[#555555] leading-relaxed">
                When you settle aircraft from the pending queue, their verified ArcScan transaction receipts will be archived and displayed here.
              </div>
              {pendingCount > 0 && (
                <button
                  onClick={() => setStatusFilter("PENDING")}
                  className="btn-pill mt-3 px-4 py-2 bg-[#111111] hover:bg-[#FF4D00] text-[#ECEBE6] text-xs font-sans cursor-pointer transition-colors"
                >
                  View Pending Queue ({pendingCount})
                </button>
              )}
            </div>
          ) : statusFilter === "PENDING" && flights.length > 0 ? (
            <div className="flex flex-col items-center gap-2 max-w-sm">
              <div className="icon-circle w-10 h-10 text-[#FF4D00] mb-1">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold text-[#111111]">
                All Landed Aircraft Settled!
              </div>
              <div className="text-xs text-[#555555] leading-relaxed">
                Every arrival in the surface queue has been verified and retired on Arc Testnet.
              </div>
              <button
                onClick={() => setStatusFilter("SETTLED")}
                className="btn-pill mt-3 px-4 py-2 bg-[#ECEBE6] hover:bg-[#111111] text-[#111111] hover:text-[#ECEBE6] border border-[#D4D3CD] text-xs font-sans cursor-pointer transition-colors"
              >
                View Settled Receipts ({settledCount})
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="icon-circle w-10 h-10 text-[#555555] mb-1">
                <Plane className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold text-[#111111]">
                No Landed Aircraft Matching Filter
              </div>
              <div className="text-xs text-[#555555]">
                Click scan to poll active airport ground transponders across European hubs
              </div>
              <button
                onClick={fetchLiveLanded}
                className="btn-pill mt-3 px-4 py-2 bg-[#111111] hover:bg-[#FF4D00] text-[#ECEBE6] text-xs font-sans cursor-pointer transition-colors"
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
          const isWatching = flight.status === "WATCHING";
          const settledHere = isSettled && Boolean(flight.txHash);
          const showEstimateChip = flight.estimatedAirborne !== false && !isWatching;

          return (
            <div
              key={flight.id}
              className={`flex flex-col justify-between h-full p-5 rounded-xl border transition-[transform,opacity] duration-140 ${
                isSettled
                  ? "bg-[#ECEBE6] border-[#D4D3CD]"
                  : isSettling
                  ? "bg-[#ECEBE6] border-[#FF4D00]/50"
                  : isWatching
                  ? "bg-[#ECEBE6] border-[#FF4D00]/50"
                  : "bg-[#ECEBE6] border-[#D4D3CD] hover:border-[#111111]"
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-[#D4D3CD]">
                  <div className="flex items-center gap-3">
                    {!isSettled && (
                      <input
                        type="checkbox"
                        checked={selectedBatchIds.has(flight.id)}
                        onChange={() => toggleBatchSelect(flight.id)}
                        className="checkbox-orange"
                        aria-label={`Select ${flight.callsign} for batch settlement`}
                      />
                    )}
                    <div className="icon-circle text-[#111111]">
                      <Plane className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold font-mono text-[#111111] tracking-tight">
                          {flight.callsign}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#D6D5CF] text-[#555555]">
                          {flight.airframe.model}
                        </span>
                      </div>
                      <div className="text-xs text-[#555555] font-sans">{flight.operator}</div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5 font-mono">
                    {settledHere && (
                      <span
                        title="Settled from this console (local receipt archive)"
                        className="px-2.5 py-0.5 text-[9px] font-bold uppercase rounded-full bg-[#ECEBE6] border border-[#D4D3CD] text-[#111111]"
                      >
                        Mine
                      </span>
                    )}
                    <div
                      className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                        isSettled
                          ? "bg-[#ECEBE6] border-[#D4D3CD] text-[#555555]"
                          : isSettling
                          ? "bg-[#FF4D00]/10 border-[#FF4D00] text-[#FF4D00] animate-pulse"
                          : isWatching
                          ? "bg-[#FF4D00]/10 border-[#FF4D00] text-[#FF4D00]"
                          : "bg-[#ECEBE6] border-[#D4D3CD] text-[#111111]"
                      }`}
                    >
                      {flight.status}
                    </div>
                  </div>
                </div>

                {/* Route & Touchdown Time */}
                <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                  <div className="bg-[#D6D5CF] rounded-lg p-2.5 border border-[#D4D3CD]">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#555555] flex items-center justify-between">
                      <span>Route</span>
                      {showEstimateChip && (
                        <span
                          title="Duration, distance, and origin are inferred from the airframe class, not measured ADS-B leg history"
                          className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#ECEBE6] text-[#555555] border border-[#D4D3CD]"
                        >
                          ESTIMATE
                        </span>
                      )}
                    </span>
                    <div className="text-[#111111] font-bold font-mono truncate mt-0.5">
                      {flight.origin} → {flight.destination}
                    </div>
                    <div className="text-[10px] font-mono text-[#555555] mt-0.5">
                      {flight.distanceKm.toLocaleString()} km • {Math.round(flight.airborneSeconds / 3600)}h {(flight.airborneSeconds % 3600) / 60}m airborne
                    </div>
                  </div>

                  <div className="bg-[#D6D5CF] rounded-lg p-2.5 border border-[#D4D3CD]">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#555555]">Touchdown</span>
                    <div className="text-[#111111] font-bold font-mono mt-0.5">
                      {flight.landedAt}
                    </div>
                    <div className="text-[10px] font-sans text-[#555555] mt-0.5">
                      Status: Wheels Down & Parked
                    </div>
                  </div>
                </div>

                {/* ICAO Emissions & SwapVM Valuation */}
                <div className="p-3 bg-[#D6D5CF] rounded-lg border border-[#D4D3CD] flex flex-col gap-1.5 text-xs mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#555555] flex items-center gap-1.5 font-sans">
                      <Flame className="w-3.5 h-3.5 text-[#FF4D00]" />
                      Fuel Consumed:
                    </span>
                    <span className="font-bold font-mono text-[#111111] tabular-nums">
                      {flight.estimate.totalFuelBurnKg.toLocaleString()} kg
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#555555] flex items-center gap-1.5 font-sans">
                      <Leaf className="w-3.5 h-3.5 text-[#111111]" />
                      Total Verified CO₂:
                    </span>
                    <span className="font-bold font-mono text-[#111111] tabular-nums">
                      {(flight.estimate.totalCo2Kg / 1000).toFixed(2)} tonnes{" "}
                      <span className="text-[10px] text-[#555555] font-normal">
                        ({flight.estimate.totalCo2Kg.toLocaleString()} kg)
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-[#D4D3CD]">
                    <span className="text-[#111111] font-semibold flex items-center gap-1.5 font-sans">
                      <Coins className="w-3.5 h-3.5 text-[#FF4D00]" />
                      SwapVM Dynamic Quote:
                    </span>
                    <span className="font-bold font-mono text-[#111111] text-sm tabular-nums">
                      ${flight.estimate.usdcCost.toFixed(2)} USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons / Explorer Receipt */}
              <div className="mt-auto pt-4 border-t border-[#D4D3CD]">
                {isSettled ? (
                  <div className="flex items-center justify-between p-3 bg-[#D6D5CF] rounded-lg border border-[#D4D3CD] text-xs">
                    <div className="flex items-center gap-2 text-[#111111] font-sans">
                      <CheckCircle2 className="w-4 h-4 text-[#FF4D00] shrink-0" />
                      <span className="font-semibold">
                        Settled On-Chain {flight.settledAt ? `(${flight.settledAt})` : ""}
                      </span>
                    </div>
                    {flight.explorerUrl && (
                      <a
                        href={flight.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-pill px-3 py-1 bg-[#ECEBE6] hover:bg-[#111111] text-[#111111] hover:text-[#ECEBE6] border border-[#D4D3CD] flex items-center gap-1.5 text-xs font-mono transition-colors"
                      >
                        <span>ArcScan Tx</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ) : isWatching ? (
                  <div className="p-3 bg-[#D6D5CF] rounded-lg border border-[#FF4D00]/40 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#111111]">
                        <Zap className="w-4 h-4 shrink-0 text-[#FF4D00]" />
                        <span className="font-semibold font-sans">
                          Watching {flight.callsign} for touchdown…
                        </span>
                      </div>
                      {onDisarm && (
                        <button
                          onClick={onDisarm}
                          className="btn-pill px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#555555] hover:text-[#FF4D00] border border-[#D4D3CD] hover:border-[#FF4D00] cursor-pointer transition-colors"
                        >
                          Disarm
                        </button>
                      )}
                    </div>
                    <div className="text-[10.5px] text-[#555555] mt-1.5 leading-relaxed font-sans">
                      Settlement broadcasts automatically to Arc Testnet the moment
                      on-ground is confirmed. Keep this tab open.
                    </div>
                  </div>
                ) : (
                  <>
                    {flight.recordingAttached && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D6D5CF] rounded-lg border border-[#D4D3CD] text-[#111111] text-[11px] mb-2 font-mono">
                        <Radio className="w-3.5 h-3.5 shrink-0 text-[#FF4D00]" />
                        <span>Recorded path attached : replay to verify, then settle from the console.</span>
                      </div>
                    )}
                    {flight.estimate.usdcCost > activeSessionCap && (
                      <div className="flex items-center justify-between px-3 py-1.5 bg-[#D6D5CF] rounded-lg border border-[#D4D3CD] text-[#111111] text-[11px] mb-2 font-mono">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#FF4D00] shrink-0" />
                          <span>Exceeds cap (${activeSessionCap.toLocaleString()} USDC)</span>
                        </div>
                        {onOpenSessionModal && (
                          <button
                            onClick={onOpenSessionModal}
                            className="underline hover:text-[#FF4D00] font-semibold text-[#111111] cursor-pointer text-[10px]"
                          >
                            Increase Cap →
                          </button>
                        )}
                      </div>
                    )}
                    {flight.recordingAttached ? (
                      <button
                        onClick={() => onReplayRecording?.(flight.id)}
                        className="btn-pill w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#111111] hover:bg-[#FF4D00] text-[#ECEBE6] font-bold text-xs font-sans transition-colors cursor-pointer"
                      >
                        <Radio className="w-4 h-4" />
                        <span>Replay Recorded Path</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => requestSettleFlight(flight)}
                        disabled={isSettling}
                        title="Broadcasts a real Arc Testnet transaction spending testnet USDC"
                        className={`btn-pill w-full flex items-center justify-center gap-2 py-2.5 px-4 font-bold text-xs font-sans transition-colors cursor-pointer ${
                          confirmId === flight.id
                            ? "bg-[#FF4D00] text-white"
                            : "bg-[#111111] hover:bg-[#FF4D00] text-[#ECEBE6]"
                        } disabled:opacity-50`}
                      >
                        <Zap className="w-4 h-4" />
                        <span>
                          {isSettling
                            ? "Broadcasting to Arc Testnet..."
                            : confirmId === flight.id
                            ? `Confirm $${flight.estimate.usdcCost.toFixed(2)} real USDC spend`
                            : `Settle Carbon Offset ($${flight.estimate.usdcCost.toFixed(2)} USDC)`}
                        </span>
                      </button>
                    )}
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
