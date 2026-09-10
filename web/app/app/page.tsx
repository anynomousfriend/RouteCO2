"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useWalletAuth } from "@/lib/use-wallet-auth";
import { useFlightSessionDelegation } from "@/lib/privy-signers";
import { isSessionSignerConfigured } from "@/lib/privy-config";
import { toast } from "sonner";
import {
  REPLAY_SCENARIOS,
  type ReplayScenario,
  type AircraftCategory,
  type LiveFlightSummary,
} from "@/lib/replay-scenarios";
import { NavigationDock } from "@/components/NavigationDock";
import { FlightMasterCard } from "@/components/FlightMasterCard";
import { DescentTimelineBar } from "@/components/DescentTimelineBar";
import { CommandSearchModal } from "@/components/CommandSearchModal";
import {
  SettlementCertificateModal,
  type SettlementCertificateData,
} from "@/components/SettlementCertificateModal";
import { AquaInspectorModal } from "@/components/AquaInspectorModal";
import {
  SessionDelegationModal,
  type SessionDelegationData,
} from "@/components/SessionDelegationModal";
import { FuelDynamicsBento } from "@/components/FuelDynamicsBento";
import { SettlementIntegrityBento } from "@/components/SettlementIntegrityBento";
import LandedSettlementQueue, {
  INITIAL_LANDED_FLIGHTS,
  type LandedFlightRecord,
} from "@/components/LandedSettlementQueue";
import {
  getStoredSettledFlights,
  mergeWithStoredSettled,
} from "@/lib/settled-storage";
import {
  AIRFRAME_PROFILES,
  DEFAULT_AIRFRAME,
  calculateLandedFlightSettlement,
} from "@/lib/icao-precision";
import { Activity, ChevronDown, ChevronUp, Globe2, Map } from "lucide-react";
import { formatEther } from "viem";
import {
  publicArcClient,
  SKYROUTE_VAULT_ADDRESS,
  SKYROUTE_VAULT_ABI,
} from "@/lib/arc-client";
import WindyFlightMap from "@/components/WindyFlightMap";

const CesiumGlobeViewer = dynamic(() => import("@/components/CesiumGlobeViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[640px] flex items-center justify-center bg-[#1e2528] text-[#a7c080] font-mono text-xs border border-dashed border-[#d3c6aa]/16">
      <div className="flex flex-col items-center gap-3">
        <Globe2 className="w-8 h-8 animate-spin text-[#a7c080]/60" />
        <span className="tracking-widest uppercase">Initializing 3D Digital Globe Engine...</span>
      </div>
    </div>
  ),
});

const DEPLOYED_VAULT_ADDRESS = SKYROUTE_VAULT_ADDRESS;

export default function FlightOperationsConsole() {
  const { ready, authenticated, user, login, logout } = useWalletAuth();
  // Privy session-signer delegation (real addSigners when quorum configured; local state otherwise)
  const sessionSigner = useFlightSessionDelegation();

  // Mode: "live" (OpenSky Network) vs "replay" (synthetic Lufthansa DLH400 touchdown physics demo)
  const [mode, setMode] = useState<"live" | "replay">("live");
  const [activeNavTab, setActiveNavTab] = useState("radar");
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  // Switch Modes and reset transient settlement states cleanly
  const switchMode = (newMode: "live" | "replay") => {
    setMode(newMode);
    setActiveNavTab(newMode === "live" ? "radar" : "schedule");
    setIsSettled(false);
    setSettlementTxHash(undefined);
    setCertificateData(null);
  };

  // 3D Globe vs 2D Radar Engine (Default: "3d")
  const [mapEngine, setMapEngine] = useState<"3d" | "2d">("3d");
  const [armedFlightCallsign, setArmedFlightCallsign] = useState<string | null>(null);
  const [landedFlights, setLandedFlights] = useState<LandedFlightRecord[]>(INITIAL_LANDED_FLIGHTS);
  const landedPendingCount = landedFlights.filter((f) => f.status === "PENDING").length;

  useEffect(() => {
    const stored = getStoredSettledFlights();
    if (stored.length > 0) {
      setLandedFlights((prev) => (prev.length === 0 ? stored : mergeWithStoredSettled(prev)));
    }
  }, []);

  const handleToggleArmSettlement = (callsign: string) => {
    if (armedFlightCallsign === callsign.toLowerCase()) {
      setArmedFlightCallsign(null);
      toast.info("Settlement Trigger Disarmed", {
        description: `Automated touchdown settlement disabled for ${callsign.toUpperCase()}.`,
      });
    } else {
      setArmedFlightCallsign(callsign.toLowerCase());
      toast.success("Settlement Trigger Armed!", {
        description: `Watcher active: When ${callsign.toUpperCase()} touches down, on-chain retirement will execute automatically on Arc Testnet.`,
      });
    }
  };

  const handleArmedTouchdown = (meta: any) => {
    if (
      armedFlightCallsign &&
      meta.callsign &&
      meta.callsign.toLowerCase() === armedFlightCallsign.toLowerCase()
    ) {
      toast.info(`Touchdown Confirmed: ${meta.callsign}`, {
        description: `Autonomous agent triggering verified carbon offset settlement on Arc Testnet...`,
      });
      triggerWheelsDownSettlement(meta);
      setArmedFlightCallsign(null);
    }
  };

  // Live Flights State
  const [liveFlights, setLiveFlights] = useState<LiveFlightSummary[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<LiveFlightSummary | null>(null);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  // Multi-Flight Replay Scenarios (Category 4)
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
  const activeScenario: ReplayScenario =
    REPLAY_SCENARIOS[selectedScenarioIndex] || REPLAY_SCENARIOS[0];
  const activeReplayFrames = activeScenario.frames;

  // Replay Playback State
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settlementTxHash, setSettlementTxHash] = useState<string | undefined>(undefined);

  // Executive Certificate Modal State
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);
  const [certificateData, setCertificateData] = useState<SettlementCertificateData | null>(null);

  // 1inch Aqua Shared TVU Inspector Modal State
  const [isAquaOpen, setIsAquaOpen] = useState(false);

  // Track 3: Privy Scoped Session Delegation Key State
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionData, setSessionData] = useState<SessionDelegationData>({
    status: "Active / Delegated",
    budgetCapUSDC: 5000,
    expiryHours: 8,
    expiresAt: Date.now() + 8 * 3600 * 1000,
    targetVaultAddress: DEPLOYED_VAULT_ADDRESS,
  });

  // Avionics & Telemetry Integrity Drawer State
  const [isIntegrityOpen, setIsIntegrityOpen] = useState(false);
  const [activeIntegrityTab, setActiveIntegrityTab] = useState<"fuel" | "integrity">("fuel");

  const activeReplayFrame = useMemo(
    () => activeReplayFrames[replayIndex] || activeReplayFrames[0],
    [activeReplayFrames, replayIndex]
  );

  // Active Treasury Wallet on Arc Testnet: Privy embedded wallet when connected.
  // Falls back to the server agent address for read-only display; settlement uses the
  // connected wallet when available (connect via passkey in <3s when Privy is configured).
  const SERVER_AGENT_FALLBACK = "0x1698fdA3A9A8Ca9530434e545986176579F01650";
  const activeWalletAddress = user?.wallet?.address || SERVER_AGENT_FALLBACK;
  const isWalletConnected = Boolean(authenticated && user?.wallet?.address);
  const [treasuryBalance, setTreasuryBalance] = useState<string | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [totalCarbonCredits, setTotalCarbonCredits] = useState<string | null>(null);
  const [isCreditsLoading, setIsCreditsLoading] = useState(true);

  // Fetch On-Chain Treasury Balance & Carbon Credits Directly From SkyRouteVault
  const fetchBalance = async () => {
    try {
      const bal = await publicArcClient.getBalance({
        address: activeWalletAddress as `0x${string}`,
      });
      const formatted = parseFloat(formatEther(bal)).toFixed(2);
      setTreasuryBalance(formatted);
    } catch (err) {
      console.error("Failed to query live Arc balance", err);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const fetchCarbonCredits = async () => {
    try {
      const credits = await publicArcClient.readContract({
        address: DEPLOYED_VAULT_ADDRESS,
        abi: SKYROUTE_VAULT_ABI,
        functionName: "totalCarbonOffsetKg",
        args: [activeWalletAddress as `0x${string}`],
      });
      setTotalCarbonCredits((credits as bigint).toString());
    } catch (err) {
      console.error("Failed to query live Arc carbon credits", err);
    } finally {
      setIsCreditsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const runQueries = async () => {
      if (!isMounted) return;
      await Promise.all([fetchBalance(), fetchCarbonCredits()]);
    };

    runQueries();
    const interval = setInterval(runQueries, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeWalletAddress]);

  // Global Keyboard Shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Poll Real-Time OpenSky Flights
  useEffect(() => {
    let isMounted = true;

    const fetchLiveFlights = async () => {
      try {
        setIsLiveLoading(true);
        const res = await fetch("/api/live-flights");
        if (!res.ok) {
          console.warn("Live ADS-B radar acquiring signals...");
          return;
        }
        const data = await res.json();
        if (isMounted && Array.isArray(data.flights) && data.flights.length > 0) {
          setLiveFlights(data.flights);
          setSelectedFlight((current) => current || data.flights[0]);
        }
      } catch (err) {
        console.warn("Live ADS-B poll notice:", err);
      } finally {
        if (isMounted) setIsLiveLoading(false);
      }
    };

    fetchLiveFlights();
    const interval = setInterval(fetchLiveFlights, 12000);

    const fetchLiveLanded = async () => {
      try {
        const res = await fetch("/api/landed-flights");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && Array.isArray(data.flights) && data.flights.length > 0) {
          setLandedFlights(() => {
            return mergeWithStoredSettled(data.flights);
          });
        }
      } catch (err) {
        console.warn("Live landed poll notice:", err);
      }
    };

    fetchLiveLanded();
    const landedInterval = setInterval(fetchLiveLanded, 25000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(landedInterval);
    };
  }, []);

  // Telemetry Calculations
  const activeData = mode === "replay" ? activeReplayFrame : selectedFlight;
  const activeAltitude = activeData?.baroAltitudeMeters ?? 0;
  const activeVelocity = activeData?.velocityMps ?? 0;

  // Derive category and hourly burn for live flight vs replay scenario
  const liveCategory: AircraftCategory = useMemo(() => {
    if (mode === "replay") return activeScenario.category;
    const equip = (selectedFlight?.equipmentType || "").toUpperCase();
    if (equip.includes("A380") || equip.includes("B747") || equip.includes("A340") || equip.includes("B77W")) return "HEAVY";
    if (equip.includes("A350") || equip.includes("B777") || equip.includes("B787") || equip.includes("A330") || equip.includes("A339")) return "WIDE_BODY";
    if (equip.includes("E190") || equip.includes("E195") || equip.includes("CRJ") || equip.includes("AT7") || equip.includes("DH8")) return "REGIONAL";
    return "NARROW_BODY";
  }, [mode, activeScenario.category, selectedFlight?.equipmentType]);

  const liveHourlyBurn = useMemo(() => {
    switch (liveCategory) {
      case "HEAVY": return 10200;
      case "WIDE_BODY": return 6500;
      case "REGIONAL": return 1600;
      case "NARROW_BODY":
      default: return 2400;
    }
  }, [liveCategory]);

  const hourlyBurn = mode === "replay" ? activeScenario.hourlyBurnKg : liveHourlyBurn;

  const airborneSeconds =
    mode === "replay"
      ? activeScenario.plannedAirborneSeconds
      : 3600;

  const fuelBurnKg = Math.round((airborneSeconds / 3600) * hourlyBurn);
  const co2Kg = Math.round(fuelBurnKg * 3.16);
  const pricePerTonne = mode === "replay" ? activeScenario.pricePerTonneUSDC : 25.0;
  const usdcCost = Math.max(0.35, +((co2Kg / 1000) * pricePerTonne).toFixed(2));
  const currentFuelFlowRate = +(hourlyBurn / 3600).toFixed(2);

  const isLanded =
    mode === "replay"
      ? activeReplayFrame.onGround || isSettled
      : Boolean(activeData?.onGround);

  // Trigger Real Settlement on Arc Testnet via /api/settle
  const triggerWheelsDownSettlement = async (targetFrame?: any) => {
    if (isSettling) return;

    // Track 3: Verify Privy Scoped Session Delegation Key Bounds
    if (sessionData.status === "Revoked") {
      toast.error("Settlement Blocked", {
        description:
          "Session delegation key has been revoked by dispatcher emergency abort. All automated settlements locked.",
      });
      return;
    }

    if (sessionData.status === "Pending Authorization") {
      toast.error("Authorization Required", {
        description:
          "Flight operations session key requires authorization before autonomous flight dispatch.",
      });
      setIsSessionModalOpen(true);
      return;
    }

    if (Date.now() > sessionData.expiresAt) {
      toast.error("Session Key Expired", {
        description:
          "Delegated flight session key has expired. Please authorize a new session window.",
      });
      setSessionData((prev) => ({ ...prev, status: "Pending Authorization" }));
      setIsSessionModalOpen(true);
      return;
    }

    if (usdcCost > sessionData.budgetCapUSDC) {
      toast.error("Budget Cap Exceeded", {
        description: `Flight settlement cost ($${usdcCost.toFixed(
          2
        )} USDC) exceeds delegated session budget cap ($${sessionData.budgetCapUSDC.toFixed(
          2
        )} USDC).`,
        action: {
          label: "Increase Cap",
          onClick: () => setIsSessionModalOpen(true),
        },
      });
      return;
    }

    setIsSettling(true);

    const isLive = mode === "live";
    const callsign = isLive
      ? (selectedFlight?.callsign || targetFrame?.callsign || "RADAR-1090")
      : activeScenario.callsign;
    const category = isLive ? liveCategory : activeScenario.category;

    const toastId = toast.loading(
      isLive
        ? `Broadcasting Flight Leg Settlement for ${callsign} to Arc Testnet...`
        : `Broadcasting Wheels-Down Settlement for ${callsign} to Arc Testnet...`
    );

    try {
      const res = await fetch("/api/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callsign,
          aircraftCategory: category,
          airborneSeconds,
          fuelBurnKg,
          co2Kg,
          usdcAmount: BigInt(Math.round(usdcCost * 1_000_000)).toString(),
          treasuryAddress: activeWalletAddress,
          swapVmBytecode: "0x01020304",
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "On-chain transaction execution failed");
      }

      setIsSettled(true);
      setSettlementTxHash(data.settleTxHash);

      // Synchronize into Landed Flights Queue
      setLandedFlights((prev) => {
        const existingIdx = prev.findIndex(
          (f) => f.callsign.toUpperCase() === callsign.toUpperCase()
        );
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            status: "SETTLED",
            txHash: data.settleTxHash,
            settledAt: "Just now",
            explorerUrl: data.explorerUrl,
          };
          return updated;
        } else {
          const flightIcao = selectedFlight?.icao24 || targetFrame?.icao24 || "3c6674";
          const flightAirframe =
            (category === "HEAVY" || String(category) === "4"
              ? AIRFRAME_PROFILES.B77W
              : category === "REGIONAL" || String(category) === "2"
              ? AIRFRAME_PROFILES.E190
              : AIRFRAME_PROFILES.A320) || DEFAULT_AIRFRAME;

          const estimate = calculateLandedFlightSettlement({
            callsign: callsign.toUpperCase(),
            icao24: flightIcao,
            airframe: flightAirframe,
            airborneSeconds,
          });

          return [
            {
              id: `${callsign.toLowerCase()}-${Date.now()}`,
              callsign: callsign.toUpperCase(),
              icao24: flightIcao,
              operator: isLive ? (selectedFlight?.originCountry ? `${selectedFlight.originCountry} Air Transport` : "Commercial Aviation") : activeScenario.airline,
              origin: isLive ? "Origin Waypoint" : activeScenario.originAirport,
              destination: isLive ? "Destination Airport" : activeScenario.destinationAirport,
              airframe: flightAirframe,
              landedAt: "Just now",
              airborneSeconds,
              distanceKm: Math.round((airborneSeconds / 3600) * 850),
              estimate,
              status: "SETTLED",
              txHash: data.settleTxHash,
              settledAt: "Just now",
              explorerUrl: data.explorerUrl,
            },
            ...prev,
          ];
        }
      });

      // Executive Audit Certificate Data
      const cert: SettlementCertificateData = {
        flightId: data.flightId || `${callsign}-${Date.now()}`,
        callsign,
        airline: isLive
          ? (selectedFlight?.originCountry ? `${selectedFlight.originCountry} Commercial Airspace` : "Commercial Airspace")
          : activeScenario.airline,
        airframe: isLive
          ? (selectedFlight?.equipmentType || (liveCategory === "HEAVY" ? "Heavy Widebody Jet" : "Commercial Jet"))
          : activeScenario.airframe,
        originAirport: isLive
          ? (selectedFlight?.originCountry ? selectedFlight.originCountry.slice(0, 3).toUpperCase() : "DEP")
          : activeScenario.originAirport,
        destinationAirport: isLive ? "RADAR" : activeScenario.destinationAirport,
        destinationName: isLive ? "Live Airspace Track" : activeScenario.destinationName,
        runway: isLive ? "ENROUTE" : activeScenario.runway,
        icao24: isLive ? (selectedFlight?.icao24 || "39DE4E") : activeScenario.icao24,
        airborneSeconds,
        fuelBurnKg,
        co2Kg,
        costUSDC: usdcCost,
        scaledCostUSDC: data.scaledCostUSDC,
        totalCarbonOffsetKg: data.totalCarbonOffsetKg,
        blockNumber: data.blockNumber,
        txHash: data.settleTxHash,
        explorerUrl: data.explorerUrl,
        agentAddress: data.agentAddress || "0x1698fdA3A9A8Ca9530434e545986176579F01650",
        vaultAddress: DEPLOYED_VAULT_ADDRESS,
        timestamp: Date.now(),
      };
      setCertificateData(cert);
      setIsCertificateOpen(true);

      toast.success(
        isLive
          ? "Flight Leg Settled on Arc Testnet! ✈️"
          : "Wheels-Down Settled on Arc Testnet! 🛬",
        {
          id: toastId,
          description: `${callsign} reconciled on-chain. Block #${data.blockNumber} (Gas: ${data.gasUsed}).`,
          duration: 12000,
          action: {
            label: "View ArcScan",
            onClick: () => window.open(data.explorerUrl, "_blank"),
          },
        }
      );

      await Promise.all([fetchBalance(), fetchCarbonCredits()]);
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

  const ensureCertificateData = () => {
    if (!certificateData) {
      const isLive = mode === "live";
      const callsign = isLive
        ? (selectedFlight?.callsign || "RADAR-1090")
        : activeScenario.callsign;
      setCertificateData({
        flightId: `${callsign}-DOC9889`,
        callsign,
        airline: isLive
          ? (selectedFlight?.originCountry ? `${selectedFlight.originCountry} Airspace` : "Commercial Airspace")
          : activeScenario.airline,
        airframe: isLive
          ? (selectedFlight?.equipmentType || "Commercial Jet")
          : activeScenario.airframe,
        originAirport: isLive
          ? (selectedFlight?.originCountry ? selectedFlight.originCountry.slice(0, 3).toUpperCase() : "DEP")
          : activeScenario.originAirport,
        destinationAirport: isLive ? "RADAR" : activeScenario.destinationAirport,
        destinationName: isLive ? "Live Airspace Sector" : activeScenario.destinationName,
        runway: isLive ? "ENROUTE" : activeScenario.runway,
        icao24: isLive ? (selectedFlight?.icao24 || "39DE4E") : activeScenario.icao24,
        airborneSeconds: isLive ? 3600 : activeScenario.plannedAirborneSeconds,
        fuelBurnKg,
        co2Kg,
        costUSDC: usdcCost,
        scaledCostUSDC: (usdcCost / 1000).toFixed(4),
        totalCarbonOffsetKg: totalCarbonCredits || undefined,
        blockNumber: undefined,
        txHash: settlementTxHash,
        explorerUrl: settlementTxHash
          ? `https://testnet.arcscan.app/tx/${settlementTxHash}`
          : undefined,
        agentAddress: "0x1698fdA3A9A8Ca9530434e545986176579F01650",
        vaultAddress: DEPLOYED_VAULT_ADDRESS,
        timestamp: Date.now(),
      });
    }
  };

  // Replay Playback Timer
  useEffect(() => {
    if (mode !== "replay" || !isPlaying) return;

    const interval = setInterval(() => {
      setReplayIndex((prev) => {
        const next = prev + 1;
        if (next >= activeReplayFrames.length) {
          setIsPlaying(false);
          return prev;
        }

        const currentFrame = activeReplayFrames[next];
        const prevFrame = activeReplayFrames[prev];

        if (
          prevFrame &&
          !prevFrame.onGround &&
          currentFrame.onGround &&
          !isSettled &&
          !isSettling
        ) {
          triggerWheelsDownSettlement(currentFrame);
        }

        return next;
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [mode, isPlaying, activeReplayFrames, isSettled, isSettling]);

  const handleStepNext = () => {
    if (replayIndex < activeReplayFrames.length - 1) {
      const next = replayIndex + 1;
      setReplayIndex(next);
      const currentFrame = activeReplayFrames[next];
      const prevFrame = activeReplayFrames[replayIndex];
      if (
        prevFrame &&
        !prevFrame.onGround &&
        currentFrame.onGround &&
        !isSettled &&
        !isSettling
      ) {
        triggerWheelsDownSettlement(currentFrame);
      }
    }
  };

  const handleJumpToTouchdown = () => {
    const tdIdx = activeScenario.touchdownIndex ?? (activeReplayFrames.length - 4);
    setReplayIndex(tdIdx);
    setIsPlaying(false);
    if (!isSettled && !isSettling) {
      triggerWheelsDownSettlement(activeReplayFrames[tdIdx]);
    }
  };

  return (
    <div className="h-screen w-full bg-[#2d353b] text-[#d3c6aa] font-mono flex overflow-hidden select-none">
      <div className="ops-grain" aria-hidden="true" />
      {/* ── 1. ULTRA-SLIM NAVIGATION DOCK (56px) ── */}
      <NavigationDock
        activeTab={activeNavTab}
        onSelectTab={(tab) => {
          setActiveNavTab(tab);
          if (tab === "radar") switchMode("live");
          if (tab === "schedule") switchMode("replay");
        }}
        onOpenAudit={() => {
          ensureCertificateData();
          setIsCertificateOpen(true);
        }}
        onOpenAqua={() => setIsAquaOpen(true)}
        onOpenSession={() => setIsSessionModalOpen(true)}
        onConnectWallet={() => {
          if (authenticated) logout();
          else login();
        }}
        isWalletConnected={Boolean(authenticated && user?.wallet)}
        walletAddress={user?.wallet?.address}
        treasuryBalance={treasuryBalance}
        sessionCapUSDC={sessionData.budgetCapUSDC}
        sessionStatus={sessionData.status}
        landedPendingCount={landedPendingCount}
      />

      {/* ── 2. FLIGHT MASTER & SCHEMATIC PANEL (400px) ── */}
      <div className="p-3 pr-0 flex flex-col shrink-0 h-full z-10 w-full max-w-[410px]">
        <FlightMasterCard
          scenario={activeScenario}
          liveCallsign={mode === "live" && selectedFlight ? selectedFlight.callsign : undefined}
          liveOriginCountry={mode === "live" && selectedFlight ? selectedFlight.originCountry : undefined}
          liveIcao24={mode === "live" && selectedFlight ? selectedFlight.icao24 : undefined}
          liveEquipmentType={mode === "live" && selectedFlight ? selectedFlight.equipmentType : undefined}
          mode={mode}
          altitudeM={activeAltitude}
          velocityMps={activeVelocity}
          fuelBurnKg={fuelBurnKg}
          co2Kg={co2Kg}
          usdcCost={usdcCost}
          scaledCostUSDC={(usdcCost / 1000).toFixed(4)}
          treasuryBalance={treasuryBalance}
          isBalanceLoading={isBalanceLoading}
          totalCarbonCredits={totalCarbonCredits}
          isCreditsLoading={isCreditsLoading}
          onOpenCommandSearch={() => setIsCommandOpen(true)}
          className="h-full"
        />
      </div>

      {/* ── 3. MAIN SPATIAL RADAR CANVAS & FLOATING BENTO HUD ── */}
      <main className="flex-1 relative h-full p-3 pl-3 flex flex-col min-w-0">
        {activeNavTab === "landed" ? (
          <div className="w-full h-full overflow-y-auto pr-1">
            <LandedSettlementQueue
              flights={landedFlights}
              onFlightsChange={setLandedFlights}
              activeSessionCap={sessionData.budgetCapUSDC}
              onOpenSessionModal={() => setIsSessionModalOpen(true)}
              onSettlementSuccess={(txHash, flight) => {
                fetchBalance();
                fetchCarbonCredits();
              }}
            />
          </div>
        ) : (
          <div className="relative w-full h-full overflow-hidden border border-dashed border-[#d3c6aa]/16 bg-[#1e2528]">
            {/* Top Floating Descent Timeline Bar (Matching Reference Top Scale) */}
            <div className="absolute top-3 left-3 right-3 z-30">
              <DescentTimelineBar
                replayIndex={replayIndex}
                totalFrames={activeReplayFrames.length}
                isPlaying={isPlaying}
                isLanded={isLanded}
                isSettled={isSettled}
                isSettling={isSettling}
                currentAltitudeM={activeAltitude}
                mode={mode}
                onTogglePlay={() => {
                  if (replayIndex >= activeReplayFrames.length - 1) {
                    setReplayIndex(0);
                    setIsSettled(false);
                    setSettlementTxHash(undefined);
                    setCertificateData(null);
                    setIsPlaying(true);
                  } else {
                    setIsPlaying((p) => !p);
                  }
                }}
                onStepNext={handleStepNext}
                onJumpToTouchdown={handleJumpToTouchdown}
                onTriggerSettlement={() => {
                  if (mode === "replay") {
                    triggerWheelsDownSettlement(activeReplayFrame);
                  } else {
                    triggerWheelsDownSettlement(selectedFlight);
                  }
                }}
                onOpenCertificate={() => {
                  ensureCertificateData();
                  setIsCertificateOpen(true);
                }}
                onScrub={(idx) => {
                  setReplayIndex(idx);
                  setIsPlaying(false);
                  const tdIdx = activeScenario.touchdownIndex ?? (activeReplayFrames.length - 4);
                  if (idx < tdIdx && isSettled) {
                    setIsSettled(false);
                    setSettlementTxHash(undefined);
                    setCertificateData(null);
                  }
                  if (idx >= tdIdx && !isSettled && !isSettling) {
                    triggerWheelsDownSettlement(activeReplayFrames[idx]);
                  }
                }}
                liveCallsign={selectedFlight?.callsign}
                liveOriginCountry={selectedFlight?.originCountry}
                liveIcao24={selectedFlight?.icao24}
                liveEquipmentType={selectedFlight?.equipmentType}
                liveVelocityMps={selectedFlight?.velocityMps}
                liveVerticalRateMps={selectedFlight?.verticalRateMps}
                usdcCost={usdcCost}
                settlementTxHash={settlementTxHash}
              />
            </div>

            {/* Fullscreen Map Canvas (3D Cesium Globe vs 2D Leaflet Radar) */}
            <div className="w-full h-full">
              {mapEngine === "3d" ? (
                <CesiumGlobeViewer
                  selectedIcao={selectedFlight?.icao24 || selectedFlight?.callsign?.toLowerCase()}
                  armedIcao={armedFlightCallsign}
                  onToggleArm={handleToggleArmSettlement}
                  onArmedTouchdown={handleArmedTouchdown}
                  onSwitchToLandedTab={() => setActiveNavTab("landed")}
                  landedCount={landedPendingCount}
                  onSelectFlight={(meta, enrichment) => {
                    if (meta) {
                      setSelectedFlight({
                        icao24: meta.icao24 || meta.callsign.toLowerCase(),
                        callsign: meta.callsign,
                        originCountry: enrichment?.operator || "Commercial Airspace",
                        longitude: meta.lon,
                        latitude: meta.lat,
                        baroAltitudeMeters: Math.round(meta.altitudeM),
                        velocityMps: Math.round(meta.velocityMps),
                        trueTrackDeg: Math.round(meta.trueTrackDeg),
                        verticalRateMps: meta.verticalRateMps,
                        onGround: meta.onGround,
                        equipmentType: enrichment?.model || enrichment?.type || "A320-200",
                      });
                    } else {
                      setSelectedFlight(null);
                    }
                  }}
                />
              ) : (
                <WindyFlightMap
                  mode={mode}
                  liveFlights={liveFlights}
                  selectedFlight={activeData}
                  replayFrame={mode === "replay" ? activeReplayFrame : null}
                  replayTrack={mode === "replay" ? activeReplayFrames : []}
                  destinationLabel={
                    mode === "replay"
                      ? `${activeScenario.destinationAirport} Runway ${activeScenario.runway}`
                      : undefined
                  }
                  onSelectFlight={(flight) => {
                    setSelectedFlight(flight as LiveFlightSummary);
                  }}
                />
              )}
            </div>

            {/* Bottom Left: Mode Switcher & 3D/2D Engine Toggle */}
            <div className="absolute bottom-3 left-3 z-30 pointer-events-auto flex items-center gap-2">
              <div className="bg-[#1e2528]/90 backdrop-blur-md px-3 py-1.5 border border-dashed border-[#d3c6aa]/16 flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => switchMode("replay")}
                  className={`px-3 py-1 font-mono font-medium transition-[transform,colors] duration-140 active:scale-[0.96] cursor-pointer ${
                    mode === "replay"
                      ? "bg-[#d3c6aa] text-[#2d353b]"
                      : "text-[#859289] hover:text-[#d3c6aa]"
                  }`}
                >
                   Touchdown Replay (Synthetic)
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("live")}
                  className={`px-3 py-1 font-mono font-medium transition-[transform,colors] duration-140 active:scale-[0.96] cursor-pointer flex items-center gap-1.5 ${
                    mode === "live"
                      ? "bg-[#d3c6aa] text-[#2d353b]"
                      : "text-[#859289] hover:text-[#d3c6aa]"
                  }`}
                >
                  <span className="w-2 h-2 bg-[#a7c080] blink-step" />
                  <span>Live Radar</span>
                </button>
              </div>

              {/* 3D vs 2D Engine Selector */}
              <div className="bg-[#1e2528]/90 backdrop-blur-md p-1 border border-dashed border-[#d3c6aa]/16 flex items-center gap-1 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setMapEngine("3d")}
                  className={`flex items-center gap-1.5 px-3 py-1 font-semibold transition-[transform,colors] duration-140 active:scale-[0.96] cursor-pointer ${
                    mapEngine === "3d"
                      ? "bg-[#a7c080] text-[#2d353b]"
                      : "text-[#859289] hover:text-[#d3c6aa]"
                  }`}
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>3D Globe</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapEngine("2d")}
                  className={`flex items-center gap-1.5 px-3 py-1 font-semibold transition-[transform,colors] duration-140 active:scale-[0.96] cursor-pointer ${
                    mapEngine === "2d"
                      ? "bg-[#a7c080] text-[#2d353b]"
                      : "text-[#859289] hover:text-[#d3c6aa]"
                  }`}
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>2D Map</span>
                </button>
              </div>
            </div>

          {/* Bottom Right: Avionics & Telemetry Integrity Expandable Drawer */}
          <div className="absolute bottom-3 right-3 z-30 flex flex-col items-end pointer-events-auto">
            {/* Expandable Drawer Panel */}
            {isIntegrityOpen && (
              <div className="mb-2 w-[420px] max-w-[calc(100vw-48px)] bg-[#1e2528]/95 backdrop-blur-md border border-dashed border-[#d3c6aa]/16 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-140">
                {/* Tab Selector */}
                <div className="flex items-center justify-between border-b border-dashed border-[#d3c6aa]/16 pb-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveIntegrityTab("fuel")}
                      className={`px-3 py-1 font-mono font-medium transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.96] ${
                        activeIntegrityTab === "fuel"
                          ? "bg-[#d3c6aa] text-[#2d353b]"
                          : "text-[#859289] hover:text-[#d3c6aa]"
                      }`}
                    >
                      Fuel Flow Dynamics
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveIntegrityTab("integrity")}
                      className={`px-3 py-1 font-mono font-medium transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.96] ${
                        activeIntegrityTab === "integrity"
                          ? "bg-[#d3c6aa] text-[#2d353b]"
                          : "text-[#859289] hover:text-[#d3c6aa]"
                      }`}
                    >
                      Settlement Integrity
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsIntegrityOpen(false)}
                    aria-label="Collapse Panel"
                    className="text-[#859289] hover:text-[#d3c6aa] p-1 hover:bg-[#d3c6aa]/10 cursor-pointer transition-colors duration-140"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Mounted Bento Components */}
                {activeIntegrityTab === "fuel" ? (
                  <FuelDynamicsBento
                    currentFuelBurnRateKgS={currentFuelFlowRate}
                    benchmarkBurnRateKgS={0.67}
                    airborneSeconds={airborneSeconds}
                    fuelBurnKg={fuelBurnKg}
                  />
                ) : (
                  <SettlementIntegrityBento
                    isSettled={isSettled}
                    isSettling={isSettling}
                    settlementTxHash={settlementTxHash}
                    blockNumber={certificateData?.blockNumber}
                    runway={mode === "replay" ? activeScenario.runway : "25L"}
                    destinationAirport={mode === "replay" ? activeScenario.destinationAirport : "EDDF"}
                  />
                )}
              </div>
            )}

            {/* Toggle Button */}
            <button
              type="button"
              onClick={() => setIsIntegrityOpen((prev) => !prev)}
              className="px-3 py-1.5 bg-[#1e2528]/90 backdrop-blur-md border border-dashed border-[#d3c6aa]/16 flex items-center gap-2 text-xs font-mono font-medium text-[#9daaa4] hover:text-[#d3c6aa] cursor-pointer active:scale-[0.96] transition-[transform,colors] duration-140"
            >
              <Activity className="w-3.5 h-3.5 text-[#a7c080]" />
              <span>Avionics & Telemetry Integrity</span>
              <span className="w-1.5 h-1.5 bg-[#a7c080] blink-step" />
              {isIntegrityOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#859289]" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-[#859289]" />
              )}
            </button>
          </div>
        </div>
      )}
    </main>

      {/* ── 4. COMMAND PALETTE MODAL (⌘K) ── */}
      <CommandSearchModal
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onSelectScenario={(scen, idx) => {
          setSelectedScenarioIndex(idx);
          setReplayIndex(0);
          setIsPlaying(false);
          setIsSettled(false);
          setSettlementTxHash(undefined);
          setCertificateData(null);
          setMode("replay");
        }}
        onSwitchMode={(m) => switchMode(m)}
        currentMode={mode}
      />

      {/* ── 5. EXECUTIVE AUDIT CERTIFICATE MODAL ── */}
      <SettlementCertificateModal
        isOpen={isCertificateOpen}
        onClose={() => setIsCertificateOpen(false)}
        data={certificateData}
      />

      {/* ── 6. 1INCH AQUA SHARED TVU MODAL ── */}
      <AquaInspectorModal
        isOpen={isAquaOpen}
        onClose={() => setIsAquaOpen(false)}
        isLanded={isLanded}
        isSettled={isSettled}
        isSettling={isSettling}
        usdcAmount={usdcCost}
        co2Kg={co2Kg}
        vaultAddress={DEPLOYED_VAULT_ADDRESS}
      />

      {/* ── 7. PRIVY SCOPED SESSION DELEGATION MODAL (Track 3) ── */}
      <SessionDelegationModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        sessionData={sessionData}
        privyDelegated={sessionSigner.delegated}
        isSignerConfigured={isSessionSignerConfigured}
        keyQuorumId={sessionSigner.keyQuorumId}
        policyId={sessionSigner.policyId}
        onUpdateBudgetCap={(cap) =>
          setSessionData((prev) => ({ ...prev, budgetCapUSDC: cap }))
        }
        onUpdateExpiryHours={(hrs) =>
          setSessionData((prev) => ({
            ...prev,
            expiryHours: hrs,
            expiresAt: Date.now() + hrs * 3600 * 1000,
          }))
        }
        onAuthorizeSession={async () => {
          // Real Privy path: add the app key quorum as a session signer on the embedded wallet
          // within the Dashboard policy (SkyRouteVault whitelist + cap + expiry).
          if (isSessionSignerConfigured && isWalletConnected) {
            try {
              await sessionSigner.addSessionSigner(activeWalletAddress);
              setSessionData((prev) => ({
                ...prev,
                status: "Active / Delegated",
                expiresAt: Date.now() + prev.expiryHours * 3600 * 1000,
              }));
              toast.success("Session Signer Delegated (Privy)", {
                description: `Quorum added on ${activeWalletAddress.slice(0, 10)}... bounded to SkyRouteVault with $${sessionData.budgetCapUSDC} cap.`,
              });
              return;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              toast.error("Privy Delegation Failed", { description: msg });
              return;
            }
          }
          // Fallback when Privy signer quorum is not configured: explicit local state (labeled in modal).
          if (!isWalletConnected) {
            toast.error("Connect Privy Wallet First", {
              description: "Log in with passkey to provision the embedded corporate wallet, then authorize.",
            });
            login();
            return;
          }
          setSessionData((prev) => ({
            ...prev,
            status: "Active / Delegated",
            expiresAt: Date.now() + prev.expiryHours * 3600 * 1000,
          }));
          toast.success("Session Key Delegated (Local)", {
            description: `Granted ${sessionData.expiryHours}h authorization bounded to SkyRouteVault with $${sessionData.budgetCapUSDC} cap. Configure PRIVY_KEY_QUORUM_ID for cryptographic delegation.`,
          });
        }}
        onRevokeSession={() => {
          setSessionData((prev) => ({ ...prev, status: "Revoked" }));
          toast.error("Emergency Abort Triggered", {
            description: "Session delegation key revoked immediately. All automated settlements locked.",
          });
        }}
      />
    </div>
  );
}
