"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useWalletAuth } from "@/lib/use-wallet-auth";
import { useFlightSessionDelegation } from "@/lib/privy-signers";
import { isSessionSignerConfigured } from "@/lib/privy-config";
import { toast } from "sonner";
import {
  type AircraftCategory,
  type LiveFlightSummary,
} from "@/lib/replay-scenarios";
import {
  loadBundledTracks,
  recordedToTrack,
  syntheticFixtureTracks,
  type PlayableTrack,
} from "@/lib/replay-tracks";
import {
  hashRecording,
  loadWatchedFlights,
  MAX_FIXES_PER_TRACK,
  observedSeconds as observedSpanSeconds,
  removeWatchedFlight,
  saveWatchedFlight,
  type RecordedFix,
  type WatchedFlight,
} from "@/lib/watchlist-store";
import {
  rankLandingCandidates,
  type LandingCandidate,
} from "@/lib/landing-candidates";
import { scaleUsdcMicro, scaledUsdc, demoScaleLabel } from "@/lib/demo-scale";
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
import { ByokPanel } from "@/components/ByokPanel";
import { deriveByokAddress } from "@/lib/byok-settler";
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
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { formatEther } from "viem";
import {
  publicArcClient,
  SKYROUTE_VAULT_ADDRESS,
  SKYROUTE_VAULT_ABI,
} from "@/lib/arc-client";
import WindyFlightMap from "@/components/WindyFlightMap";
import { RadialGridArt } from "@/components/GenerativeVectors";

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

  // 2D Leaflet radar engine (3D Cesium globe removed on this branch).
  const [armedFlightCallsign, setArmedFlightCallsign] = useState<string | null>(null);
  const armTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [landedFlights, setLandedFlights] = useState<LandedFlightRecord[]>(INITIAL_LANDED_FLIGHTS);
  const landedPendingCount = landedFlights.filter((f) => f.status === "PENDING").length;

  const clearArmTimer = () => {
    if (armTimeout.current) {
      clearTimeout(armTimeout.current);
      armTimeout.current = null;
    }
  };

  useEffect(() => {
    const stored = getStoredSettledFlights();
    if (stored.length > 0) {
      setLandedFlights((prev) => (prev.length === 0 ? stored : mergeWithStoredSettled(prev)));
    }
  }, []);

  useEffect(() => {
    return () => clearArmTimer();
  }, []);

  const disarmSettlement = (silent = false) => {
    clearArmTimer();
    setArmedFlightCallsign(null);
    if (!silent) {
      toast.info("Settlement Trigger Disarmed", {
        description: "Automated touchdown watch disabled.",
      });
    }
  };

  const handleToggleArmSettlement = (callsign: string) => {
    const key = callsign.toLowerCase();
    if (armedFlightCallsign === key) {
      disarmSettlement();
      return;
    }
    // Eligibility: the flight must be a live airborne radar track. Arming an
    // already-landed (or unknown) contact would wait forever with no feedback.
    const live = liveFlights.find(
      (f) => f.callsign.toLowerCase() === key || f.icao24.toLowerCase() === key
    );
    if (!live) {
      toast.error("Cannot Arm Settlement", {
        description: `${callsign.toUpperCase()} is not on live radar. Select a tracked airborne flight first.`,
      });
      return;
    }
    if (live.onGround) {
      toast.error("Cannot Arm Settlement", {
        description: `${live.callsign.toUpperCase()} is already on the ground. Arm an airborne flight, or settle it directly from the Landed queue.`,
      });
      return;
    }
    clearArmTimer();
    setArmedFlightCallsign(key);
    // Timeout: an armed watch that never sees touchdown disarms itself loudly
    // instead of waiting forever (lost radar contact, diverted flight, tab left open).
    armTimeout.current = setTimeout(() => {
      setArmedFlightCallsign(null);
      armTimeout.current = null;
      toast.warning("Settlement Watch Expired", {
        description: `No touchdown detected for ${live.callsign.toUpperCase()} within 15 minutes. Watch disarmed: re-arm to continue.`,
        duration: 10000,
      });
    }, 15 * 60 * 1000);
    toast.success("Settlement Trigger Armed!", {
      description: `Watcher active: when ${live.callsign.toUpperCase()} touches down, on-chain retirement executes automatically on Arc Testnet. Track it in the Landed tab under WATCHING.`,
      duration: 8000,
    });
  };

  // ---- Flight Watchlist: record path → land → replay → manual settle ----
  // Watching and armed auto-settle are mutually exclusive per flight: a manual
  // review intent (watch) always wins over autonomous settlement (arm).
  // 2D-ONLY ENGINE: the globe's FlightTrackerApp is gone. Recording appends one
  // ADS-B fix per live-radar poll (see the recorder effect below), and
  // airborne→ground transitions in the same poll drive touchdown handling.
  // Refs mirror state so the poll-driven effect never acts on stale closures.
  const watchedRef = useRef<WatchedFlight[]>([]);
  const armedRef = useRef<string | null>(null);
  // Watchlist state lives here (above the refs that mirror it).
  const [watched, setWatched] = useState<WatchedFlight[]>(() => {
    const initial = loadWatchedFlights();
    watchedRef.current = initial;
    return initial;
  });
  useEffect(() => {
    watchedRef.current = watched;
  }, [watched]);
  useEffect(() => {
    armedRef.current = armedFlightCallsign;
  }, [armedFlightCallsign]);

  const persistWatchList = (list: WatchedFlight[]) => {
    watchedRef.current = list;
    try {
      for (const w of list) saveWatchedFlight(w);
    } catch (err) {
      toast.error("Recording Storage Full", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
    rebuildRecordedTracks(list);
  };

  // Rolling pre-watch position buffer: every live-radar poll stores one fix
  // per airborne flight (cap 240 ≈ 48 min at 12s polls), plus recent VSI
  // samples for smoothed landing-ETA ranking. When the user Watches a
  // flight, the buffer seeds its recording so replay shows past positions,
  // not just the tail observed after Watch. Tab-lifetime only (memory).
  const POSITION_BUFFER_MAX = 240;
  const positionBufferRef = useRef<Map<string, RecordedFix[]>>(new Map());
  const vsiHistoryRef = useRef<Map<string, number[]>>(new Map());

  const bufferKeyOf = (f: { icao24?: string; callsign?: string }) =>
    (f.icao24 || f.callsign || "").toLowerCase();

  const seedFixesFromBuffer = (key: string): RecordedFix[] =>
    (positionBufferRef.current.get(key.toLowerCase()) || []).slice();

  // Radar-contact loss tracking: a WATCHING flight missing from consecutive
  // polls (coverage gap, landed outside receiver range) keeps its recording
  // and stays replay-previewable; the UI flags it instead of going silent.
  const missCountRef = useRef<Map<string, number>>(new Map());
  const lostToastedRef = useRef<Set<string>>(new Set());
  const [signalLostKeys, setSignalLostKeys] = useState<string[]>([]);
  const markSignalLost = (key: string) =>
    setSignalLostKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  const markSignalFound = (key: string) =>
    setSignalLostKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : prev));

  const handleToggleWatch = async (callsign: string) => {
    const key = callsign.toLowerCase();
    const existing = watchedRef.current.find((w) => w.key === key);
    if (existing) {
      // Stop watching. Keep the recording if it has fixes (manual-clear retention).
      if (existing.fixes.length >= 2 || existing.status === "LANDED_RECORDED") {
        toast.info("Watch Stopped: Recording Kept", {
          description: `${existing.callsign} kept with ${existing.fixes.length} recorded fixes. Delete it explicitly to remove.`,
        });
      } else {
        removeWatchedFlight(key);
        unregisterServerWatch(key, true);
        const next = watchedRef.current.filter((w) => w.key !== key);
        rebuildRecordedTracks(next);
        toast.info("Watch Stopped", {
          description: `${existing.callsign} had too few fixes to keep; removed.`,
        });
      }
      return;
    }
    const live = liveFlights.find(
      (f) => f.callsign.toLowerCase() === key || f.icao24.toLowerCase() === key
    );
    if (!live) {
      toast.error("Cannot Watch Flight", {
        description: `${callsign.toUpperCase()} is not on live radar. Select a tracked flight first.`,
      });
      return;
    }
    if (live.onGround) {
      toast.error("Cannot Watch Flight", {
        description: `${live.callsign.toUpperCase()} is already on the ground: settle it from the Landed queue instead.`,
      });
      return;
    }
    if (armedFlightCallsign === live.callsign.toLowerCase()) {
      disarmSettlement(true);
      toast.info("Auto-Settle Disarmed", {
        description: `Manual watch intent wins: ${live.callsign.toUpperCase()} will no longer auto-settle.`,
      });
    }
    const entryKey = (live.icao24 || live.callsign).toLowerCase();
    // 1. Seed from the rolling pre-watch buffer (past positions while tab was open).
    let seed: RecordedFix[] = seedFixesFromBuffer(entryKey);
    if (seed.length === 0 && live.callsign) {
      seed = seedFixesFromBuffer(live.callsign.toLowerCase());
    }
    // 2. Backfill deeper history via OpenSky live track (free tracks/all, best-effort).
    // Merged + sorted + deduped below; empty on coverage gaps (honest, never mocked).
    if (live.icao24) {
      try {
        const res = await fetch(`/api/track-history?icao24=${encodeURIComponent(live.icao24)}`);
        if (res.ok) {
          const data = await res.json();
          const past: RecordedFix[] = Array.isArray(data.fixes) ? data.fixes : [];
          if (past.length > 0) {
            const seen = new Set(seed.map((f) => f.t));
            for (const f of past) {
              if (
                typeof f.t === "number" &&
                typeof f.lat === "number" &&
                typeof f.lon === "number" &&
                !seen.has(f.t)
              ) {
                seed.push({
                  t: f.t,
                  lat: f.lat,
                  lon: f.lon,
                  altM: f.altM ?? 0,
                  velMps: f.velMps ?? 0,
                  vsiMps: f.vsiMps ?? 0,
                  trackDeg: f.trackDeg ?? 0,
                  onGround: Boolean(f.onGround),
                });
                seen.add(f.t);
              }
            }
            seed.sort((a, b) => a.t - b.t);
          }
        }
      } catch {
        // Backfill is best-effort: live recording continues regardless.
      }
    }
    if (seed.length > MAX_FIXES_PER_TRACK) seed = seed.slice(-MAX_FIXES_PER_TRACK);
    const entry: WatchedFlight = {
      key: entryKey,
      icao24: (live.icao24 || "").toLowerCase(),
      callsign: live.callsign.toUpperCase(),
      equipmentType: live.equipmentType,
      originCountry: live.originCountry,
      watchStartedAt: Date.now(),
      status: "WATCHING",
      fixes: seed,
    };
    const next = [entry, ...watchedRef.current.filter((w) => w.key !== entry.key)];
    persistWatchList(next);
    // Durability: the sidecar keeps recording with tabs closed (best-effort).
    registerServerWatch(entry);
    toast.success(
      seed.length >= 2
        ? `Watching ${entry.callsign} (+${seed.length} past fixes)`
        : `Watching Flight Path`,
      {
        description:
          seed.length >= 2
            ? `Seeded ${seed.length} past positions; recording every radar poll. Replay unlocks at touchdown with the full trajectory.`
            : `Recording ${entry.callsign} every radar poll. It stays pinned even off-camera; replay unlocks at touchdown.`,
        duration: 8000,
      }
    );
  };

  const handleWatchedTouchdown = (key: string) => {
    const w = watchedRef.current.find((x) => x.key === key.toLowerCase());
    if (!w || w.status === "LANDED_RECORDED") return;
    const fixes: RecordedFix[] = w.fixes;
    const landed: WatchedFlight = { ...w, status: "LANDED_RECORDED", landedAt: Date.now(), fixes };
    const next = watchedRef.current.map((x) => (x.key === landed.key ? landed : x));
    persistWatchList(next);
    injectLandedQueue(landed);
    toast.success(`Touchdown Recorded: ${landed.callsign}`, {
      description: `Path frozen with ${fixes.length} fixes over ${Math.round(observedSpanSeconds(landed) / 60)} min. Open its card, replay, verify, then settle manually.`,
      duration: 10000,
    });
  };

  // Injects a landed recording into the Landed queue as a replayable PENDING
  // record. Direct settle is disabled for these cards (see queue): the flow is
  // replay → verify → settle from the console, which prices the observed track.
  const injectLandedQueue = (landed: WatchedFlight) => {
    const observed = observedSpanSeconds(landed);
    setLandedFlights((prev) => {
      if (prev.some((f) => f.id === `rec-${landed.key}`)) return prev;
      const rec: LandedFlightRecord = {
        id: `rec-${landed.key}`,
        callsign: landed.callsign,
        icao24: landed.icao24,
        operator: landed.originCountry ? `${landed.originCountry} Recorded Track` : "Recorded Live Track",
        origin: "Observed segment",
        destination: "Touchdown (recorded)",
        airframe: AIRFRAME_PROFILES.A320,
        landedAt: "Just now (recorded)",
        airborneSeconds: observed,
        distanceKm: 0,
        estimatedAirborne: true,
        estimationMethod: "recorded-partial-segment",
        estimate: {
          callsign: landed.callsign,
          icao24: landed.icao24,
          airframe: AIRFRAME_PROFILES.A320,
          airborneSeconds: observed,
          totalFuelBurnKg: 0,
          totalCo2Kg: 0,
          usdcCost: 0,
          usdcAmountMicro: "0",
          swapVmBytecode: "0x01020304",
        },
          status: "PENDING",
        recordingAttached: true,
      };
      return [rec, ...prev];
    });
  };

  // ---- Server-side recorder sync (sidecar keeps recording with tabs closed) ----
  // The client registers Watch intent server-side (fire-and-forget; local
  // recording continues regardless) and periodically merges server tracks back:
  // union of fixes by timestamp, status flips to LANDED_RECORDED when the
  // server observed touchdown — including landings that happened while no tab
  // was open. No mock data involved: every fix is live ADS-B on both sides.
  const serverDownToastedRef = useRef(false);

  const registerServerWatch = (w: WatchedFlight) => {
    fetch("/api/server-watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: w.key,
        icao24: w.icao24,
        callsign: w.callsign,
        equipmentType: w.equipmentType,
        originCountry: w.originCountry,
      }),
    }).catch(() => {
      if (!serverDownToastedRef.current) {
        serverDownToastedRef.current = true;
        toast.info("Server Recorder Offline", {
          description:
            "Recording locally in this tab only. Run `cd web && npm run recorder` in a second terminal — it keeps recording with tabs closed.",
          duration: 12000,
        });
      }
    });
  };

  const unregisterServerWatch = (key: string, deleteTrack: boolean) => {
    fetch(`/api/server-watch?key=${encodeURIComponent(key)}${deleteTrack ? "&delete=1" : ""}`, {
      method: "DELETE",
    }).catch(() => {});
  };

  const syncServerTracks = async () => {
    let meta: Array<{
      key: string;
      icao24: string;
      callsign: string;
      equipmentType?: string;
      originCountry?: string;
      watchStartedAt: number;
      status: "WATCHING" | "LANDED_RECORDED";
      landedAt?: number;
      fixCount: number;
      truncated?: boolean;
      auto?: boolean;
    }>;
    try {
      const res = await fetch("/api/server-tracks");
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data.tracks) || data.tracks.length === 0) return;
      meta = data.tracks;
    } catch {
      return;
    }
    const merged = [...watchedRef.current];
    let dirty = false;
    const newlyLanded: WatchedFlight[] = [];
    for (const m of meta) {
      const idx = merged.findIndex((x) => x.key === m.key);
      const lw = idx >= 0 ? merged[idx] : undefined;
      const needsFull =
        !lw ||
        m.fixCount > lw.fixes.length ||
        (m.status === "LANDED_RECORDED" && lw.status !== "LANDED_RECORDED");
      if (!needsFull) continue;
      try {
        const r = await fetch(`/api/server-tracks?key=${encodeURIComponent(m.key)}`);
        if (!r.ok) continue;
        const data = await r.json();
        const track = data.track as (WatchedFlight & { fixes: RecordedFix[] }) | undefined;
        if (!track || !Array.isArray(track.fixes)) continue;
        if (!lw) {
          const entry: WatchedFlight = {
            key: track.key,
            icao24: track.icao24 || "",
            callsign: track.callsign,
            equipmentType: track.equipmentType,
            originCountry: track.originCountry,
            watchStartedAt: track.watchStartedAt || Date.now(),
            status: track.status === "LANDED_RECORDED" ? "LANDED_RECORDED" : "WATCHING",
            landedAt: track.landedAt,
            fixes: track.fixes,
            truncated: track.truncated,
            auto: track.auto ?? m.auto ?? false,
          };
          merged.unshift(entry);
          dirty = true;
          if (entry.status === "LANDED_RECORDED") newlyLanded.push(entry);
        } else {
          const seen = new Set(lw.fixes.map((f) => f.t));
          const add = (track.fixes as RecordedFix[]).filter(
            (f) => f && typeof f.t === "number" && typeof f.lat === "number" && !seen.has(f.t)
          );
          const landedFlip =
            track.status === "LANDED_RECORDED" && lw.status !== "LANDED_RECORDED";
          if (add.length > 0 || landedFlip) {
            const fixes = [...lw.fixes, ...add]
              .sort((a, b) => a.t - b.t)
              .slice(-MAX_FIXES_PER_TRACK);
            merged[idx] = {
              ...lw,
              fixes,
              status: landedFlip ? "LANDED_RECORDED" : lw.status,
              landedAt: track.landedAt ?? lw.landedAt,
              truncated: track.truncated ?? lw.truncated,
            };
            dirty = true;
            if (landedFlip) newlyLanded.push(merged[idx]);
          }
        }
      } catch {
        /* next key */
      }
    }
    if (dirty) {
      persistWatchList(merged);
      for (const l of newlyLanded) {
        injectLandedQueue(l);
        toast.success(`Touchdown Recorded (server): ${l.callsign}`, {
          description: `Recorded while tabs were closed: ${l.fixes.length} fixes. Open its card, replay, verify, then settle manually.`,
          duration: 10000,
        });
      }
    }
  };

  // Live Flights State
  const [liveFlights, setLiveFlights] = useState<LiveFlightSummary[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<LiveFlightSummary | null>(null);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  // Replay tracks: bundled demo seed + user-recorded live tracks
  // (+ synthetic fixtures only with ?dev-synthetic=1). Replaces the old
  // static scenario list: every replayable track is real recorded ADS-B.
  const [playableTracks, setPlayableTracks] = useState<PlayableTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const activeTrack: PlayableTrack | null =
    playableTracks.find((t) => t.id === selectedTrackId) || playableTracks[0] || null;
  const activeReplayFrames = activeTrack?.frames || [];

  // Watchlist keys for 2D map marker tinting (watched vs armed vs default).
  const watchedKeys = useMemo(() => watched.map((w) => w.key), [watched]);

  // Landing-soon filter: live flights about to land, ranked by ETA.
  // VSI history ref is mutated per poll (no re-render); include liveFlights
  // so the memo recomputes every 12s radar tick.
  const landingCandidates: LandingCandidate[] = useMemo(
    () => rankLandingCandidates(liveFlights, vsiHistoryRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveFlights]
  );

  // Load bundled demo seeds once, then rebuild the track list whenever
  // recordings change. Synthetic fixtures only behind the dev flag.
  useEffect(() => {
    let cancelled = false;
    loadBundledTracks().then((bundled) => {
      if (cancelled) return;
      // Include in-progress WATCHING recordings (≥2 fixes) as replayable
      // previews so a watched flight is visible immediately — not only after
      // touchdown. recordedToTrack drops <2-fix tracks itself.
      const recorded = loadWatchedFlights()
        .map((w) => recordedToTrack(w, "recorded"))
        .filter((t): t is PlayableTrack => t !== null);
      const tracks = [...bundled, ...recorded, ...syntheticFixtureTracks()];
      setPlayableTracks(tracks);
      setSelectedTrackId((prev) => prev || tracks[0]?.id || null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rebuildRecordedTracks = (list: WatchedFlight[]) => {
    setWatched(list);
    const recorded = list
      .map((w) => recordedToTrack(w, "recorded"))
      .filter((t): t is PlayableTrack => t !== null);
    setPlayableTracks((prev) => {
      const rest = prev.filter((t) => t.source !== "recorded");
      const bundled = rest.filter((t) => t.source === "bundled");
      const synthetic = rest.filter((t) => t.source === "synthetic");
      return [...bundled, ...recorded, ...synthetic];
    });
  };

  // Keep selection valid as the track list changes (bundle load, new recordings).
  useEffect(() => {
    if (!selectedTrackId || !playableTracks.some((t) => t.id === selectedTrackId)) {
      const first = playableTracks[0]?.id || null;
      if (first !== selectedTrackId) setSelectedTrackId(first);
    }
  }, [playableTracks, selectedTrackId]);

  const fmtZuluHM = (epochSec: number | null | undefined) => {
    if (!epochSec) return "--";
    try {
      return `${new Date(epochSec * 1000).toISOString().slice(11, 16)}Z`;
    } catch {
      return "--";
    }
  };

  /** Selects a replay track and resets transient playback/settlement state. */
  const selectTrack = (trackId: string) => {
    setSelectedTrackId(trackId);
    setReplayIndex(0);
    setIsPlaying(false);
    setIsSettled(false);
    setSettlementTxHash(undefined);
    setCertificateData(null);
  };

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

  // BYOK self-testing: visitor testnet key, memory-only (never persisted/sent).
  // When active, settlements sign locally in-browser instead of the server route.
  const [byokKey, setByokKey] = useState<`0x${string}` | null>(null);
  const [isByokOpen, setIsByokOpen] = useState(false);
  const byokAddress = useMemo(() => {
    if (!byokKey) return null;
    try {
      return deriveByokAddress(byokKey);
    } catch {
      return null;
    }
  }, [byokKey]);

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
        // Include watched/armed icao24s so the server keeps returning those
        // contacts even after touchdown (on-ground states) — otherwise a
        // watched landing silently vanishes and never flips to LANDED_RECORDED.
        const watchKeys = new Set<string>();
        for (const w of watchedRef.current) {
          if (/^[0-9a-f]{4,6}$/.test(w.icao24)) watchKeys.add(w.icao24);
        }
        const armed = armedRef.current;
        if (armed && /^[0-9a-f]{4,6}$/.test(armed)) watchKeys.add(armed);
        const qs = watchKeys.size > 0 ? `?watch=${[...watchKeys].join(",")}` : "";
        const res = await fetch(`/api/live-flights${qs}`);
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
    void syncServerTracks();
    const landedInterval = setInterval(() => {
      void fetchLiveLanded();
      void syncServerTracks();
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(landedInterval);
    };
  }, []);

  // 2D-ONLY WATCH/ARM ENGINE (replaces the globe FlightTrackerApp): every
  // live-radar poll appends one ADS-B fix to each WATCHING track and checks
  // airborne→ground transitions for watched + armed flights.
  useEffect(() => {
    if (liveFlights.length === 0) return;
    const byKey = new Map(
      liveFlights.map((f) => [(f.icao24 || f.callsign).toLowerCase(), f])
    );
    const matchLive = (key: string, callsign: string) =>
      byKey.get(key.toLowerCase()) ||
      liveFlights.find(
        (f) =>
          f.callsign.toLowerCase() === callsign.toLowerCase() ||
          (f.icao24 || "").toLowerCase() === key.toLowerCase()
      );

    // 0. Feed the rolling pre-watch buffer + VSI history for ALL live flights
    // (powers landing-candidate ETA smoothing and Watch-time past seeding).
    for (const f of liveFlights) {
      if (f.latitude == null || f.longitude == null) continue;
      const bKey = bufferKeyOf(f);
      const buf = positionBufferRef.current.get(bKey) || [];
      buf.push({
        t: Date.now(),
        lat: f.latitude,
        lon: f.longitude,
        altM: f.baroAltitudeMeters ?? 0,
        velMps: f.velocityMps ?? 0,
        vsiMps: f.verticalRateMps ?? 0,
        trackDeg: f.trueTrackDeg ?? 0,
        onGround: Boolean(f.onGround),
      });
      while (buf.length > POSITION_BUFFER_MAX) buf.shift();
      positionBufferRef.current.set(bKey, buf);
      if (positionBufferRef.current.size > 400) {
        const oldest = positionBufferRef.current.keys().next().value;
        if (oldest) positionBufferRef.current.delete(oldest);
      }
      const vh = vsiHistoryRef.current.get(bKey) || [];
      vh.push(f.verticalRateMps ?? 0);
      while (vh.length > 5) vh.shift();
      vsiHistoryRef.current.set(bKey, vh);
    }

    // 1. Append one fix per WATCHING track (capped; manual-clear retention).
    // A watch missing from the feed (coverage gap) is NOT dropped: misses are
    // counted and flagged so the user sees "signal lost" instead of silence.
    let grew = false;
    const next = watchedRef.current.map((w) => {
      if (w.status !== "WATCHING") return w;
      const live = matchLive(w.key, w.callsign);
      if (!live || live.latitude == null || live.longitude == null) {
        const misses = (missCountRef.current.get(w.key) || 0) + 1;
        missCountRef.current.set(w.key, misses);
        if (misses === 5 && w.fixes.length >= 2 && !lostToastedRef.current.has(w.key)) {
          lostToastedRef.current.add(w.key);
          markSignalLost(w.key);
          toast.warning(`Radar Contact Lost: ${w.callsign}`, {
            description: `No ADS-B fix for ~60s (coverage gap or out of range). Recording kept with ${w.fixes.length} fixes — replay preview stays available and re-acquires automatically.`,
            duration: 10000,
          });
        }
        return w;
      }
      if (missCountRef.current.get(w.key)) {
        missCountRef.current.delete(w.key);
        lostToastedRef.current.delete(w.key);
        markSignalFound(w.key);
      }
      if (w.fixes.length >= MAX_FIXES_PER_TRACK) {
        if (!w.truncated) {
          grew = true;
          return { ...w, truncated: true };
        }
        return w;
      }
      grew = true;
      const fix: RecordedFix = {
        t: Date.now(),
        lat: live.latitude,
        lon: live.longitude,
        altM: live.baroAltitudeMeters ?? 0,
        velMps: live.velocityMps ?? 0,
        vsiMps: live.verticalRateMps ?? 0,
        trackDeg: live.trueTrackDeg ?? 0,
        onGround: Boolean(live.onGround),
      };
      return { ...w, fixes: [...w.fixes, fix] };
    });
    if (grew) persistWatchList(next);

    // 2. Touchdowns: watched flights freeze and queue for replay → settle.
    for (const w of watchedRef.current) {
      if (w.status !== "WATCHING") continue;
      const live = matchLive(w.key, w.callsign);
      if (live && live.onGround) handleWatchedTouchdown(w.key);
    }

    // 3. Armed auto-settle: touchdown executes the on-chain retirement.
    const armedKey = armedRef.current;
    if (armedKey) {
      const live =
        byKey.get(armedKey.toLowerCase()) ||
        liveFlights.find(
          (f) =>
            f.callsign.toLowerCase() === armedKey.toLowerCase() ||
            (f.icao24 || "").toLowerCase() === armedKey.toLowerCase()
        );
      if (live && live.onGround) {
        toast.info(`Touchdown Confirmed: ${live.callsign}`, {
          description: `Autonomous agent triggering verified carbon offset settlement on Arc Testnet...`,
        });
        clearArmTimer();
        setArmedFlightCallsign(null);
        void triggerWheelsDownSettlement(live);
      }
    }
    // Effect is intentionally poll-driven: fresh closures each liveFlights tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFlights]);

  // Telemetry Calculations
  const activeData = mode === "replay" ? activeReplayFrame : selectedFlight;
  const activeAltitude = activeData?.baroAltitudeMeters ?? 0;
  const activeVelocity = activeData?.velocityMps ?? 0;

  // Derive category and hourly burn for live flight vs replay track
  const liveCategory: AircraftCategory = useMemo(() => {
    if (mode === "replay") return activeTrack?.category || "NARROW_BODY";
    const equip = (selectedFlight?.equipmentType || "").toUpperCase();
    if (equip.includes("A380") || equip.includes("B747") || equip.includes("A340") || equip.includes("B77W")) return "HEAVY";
    if (equip.includes("A350") || equip.includes("B777") || equip.includes("B787") || equip.includes("A330") || equip.includes("A339")) return "WIDE_BODY";
    if (equip.includes("E190") || equip.includes("E195") || equip.includes("CRJ") || equip.includes("AT7") || equip.includes("DH8")) return "REGIONAL";
    return "NARROW_BODY";
  }, [mode, activeTrack?.category, selectedFlight?.equipmentType]);

  const liveHourlyBurn = useMemo(() => {
    switch (liveCategory) {
      case "HEAVY": return 10200;
      case "WIDE_BODY": return 6500;
      case "REGIONAL": return 1600;
      case "NARROW_BODY":
      default: return 2400;
    }
  }, [liveCategory]);

  const hourlyBurn = mode === "replay" ? (activeTrack?.hourlyBurnKg || 2400) : liveHourlyBurn;

  const airborneSeconds =
    mode === "replay"
      ? (activeTrack?.plannedAirborneSeconds || 0)
      : 3600;

  const fuelBurnKg = Math.round((airborneSeconds / 3600) * hourlyBurn);
  const co2Kg = Math.round(fuelBurnKg * 3.16);
  const pricePerTonne = mode === "replay" ? (activeTrack?.pricePerTonneUSDC || 25.0) : 25.0;
  const usdcCost = Math.max(0.35, +((co2Kg / 1000) * pricePerTonne).toFixed(2));
  const currentFuelFlowRate = +(hourlyBurn / 3600).toFixed(2);

  const isLanded =
    mode === "replay"
      ? (activeReplayFrame?.onGround || false) || isSettled
      : Boolean(activeData?.onGround);

  // Trigger Real Settlement on Arc Testnet via /api/settle
  // opts.openCertificate === false: autoplay path (replay timer) — the full-screen
  // certificate must NOT hijack the screen mid-playback (it covers the track
  // list). The toast still fires and the Audit button opens the certificate.
  const triggerWheelsDownSettlement = async (targetFrame?: any, opts?: { openCertificate?: boolean }) => {
    if (isSettling) return;

    // Track 3: Verify Privy Scoped Session Delegation Key Bounds
    // Delegated-session bounds gate the server route only. BYOK settles with
    // the visitor own key (own money), so these checks are skipped then.
    if (!byokKey && sessionData.status === "Revoked") {
      toast.error("Settlement Blocked", {
        description:
          "Session delegation key has been revoked by dispatcher emergency abort. All automated settlements locked.",
      });
      return;
    }

    if (!byokKey && sessionData.status === "Pending Authorization") {
      toast.error("Authorization Required", {
        description:
          "Flight operations session key requires authorization before autonomous flight dispatch.",
      });
      setIsSessionModalOpen(true);
      return;
    }

    if (!byokKey && Date.now() > sessionData.expiresAt) {
      toast.error("Session Key Expired", {
        description:
          "Delegated flight session key has expired. Please authorize a new session window.",
      });
      setSessionData((prev) => ({ ...prev, status: "Pending Authorization" }));
      setIsSessionModalOpen(true);
      return;
    }

    // Session cap gates the EXECUTED (demo-scaled) spend, not the full estimate.
    const executedUsdc = scaledUsdc(usdcCost);
    if (!byokKey && executedUsdc > sessionData.budgetCapUSDC) {
      toast.error("Budget Cap Exceeded", {
        description: `Flight settlement executes $${executedUsdc.toFixed(
          2
        )} USDC at ${demoScaleLabel()} demo scale (full estimate $${usdcCost.toFixed(
          2
        )}), exceeding the delegated cap ($${sessionData.budgetCapUSDC.toFixed(
          2
        )} USDC).`,
        action: {
          label: "Increase Cap",
          onClick: () => setIsSessionModalOpen(true),
        },
      });
      return;
    }

    // Pre-flight treasury spend guard: verify real USDC covers the pull before broadcasting.
    // BYOK settles from the visitor's own wallet, so the guard checks that address.
    // Guard amount is the scaled execution amount (what the chain will pull).
    {
      const { checkTreasuryFunds } = await import(
        "@/lib/treasury-guard"
      );
      const neededMicro = scaleUsdcMicro(BigInt(Math.round(usdcCost * 1_000_000)));
      const guardTreasury = byokKey && byokAddress ? byokAddress : activeWalletAddress;
      const funds = await checkTreasuryFunds(guardTreasury, neededMicro);
      if (!funds.ok) {
        const { insufficientFundsToast } = await import("@/lib/treasury-guard");
        const t = insufficientFundsToast(funds, guardTreasury);
        toast.error(t.title, {
          description: t.description,
          duration: t.duration,
          action: t.action,
        });
        return;
      }
    }

    setIsSettling(true);

    const isLive = mode === "live";
    const callsign = isLive
      ? (selectedFlight?.callsign || targetFrame?.callsign || "RADAR-1090")
      : (activeTrack?.callsign || targetFrame?.callsign || "RECORDED-TRACK");
    const category = isLive ? liveCategory : (activeTrack?.category || liveCategory);

    const toastId = toast.loading(
      byokKey
        ? `Signing Flight Settlement locally for ${callsign} (your key, your wallet)...`
        : isLive
        ? `Broadcasting Flight Leg Settlement for ${callsign} to Arc Testnet...`
        : `Broadcasting Wheels-Down Settlement for ${callsign} to Arc Testnet...`
    );

    const STEP_LABELS: Record<string, string> = {
      register: "manifest registered",
      approve: "Aqua approved",
      ship: "strategy shipped",
      settle: "offset settled",
      verify: "receipt verified",
    };

    try {
      type SettleData = {
        flightId?: string;
        settleTxHash: string;
        registerTxHash?: string;
        blockNumber: number;
        gasUsed: string;
        explorerUrl: string;
        scaledCostUSDC?: string;
        totalCarbonOffsetKg?: string;
        agentAddress?: string;
        error?: string;
      };
      let data: SettleData;
      if (byokKey) {
        // BYOK: four transactions signed locally in-browser; the key never leaves this device.
        const { runByokSettlement } = await import("@/lib/byok-settler");
        const aquaAddress = process.env.NEXT_PUBLIC_AQUA_CORE_ADDRESS as `0x${string}`;
        const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
        if (!aquaAddress || !usdcAddress) {
          throw new Error("BYOK misconfigured: missing Aqua/USDC addresses.");
        }
        const result = await runByokSettlement(
          byokKey,
          {
            callsign,
            aircraftCategory: category,
            airborneSeconds: Math.floor(airborneSeconds),
            fuelBurnKg: Math.floor(fuelBurnKg),
            co2Kg: Math.floor(co2Kg),
            usdcAmountMicro: scaleUsdcMicro(BigInt(Math.round(usdcCost * 1_000_000))),
            swapVmBytecode: "0x01020304",
            vaultAddress: DEPLOYED_VAULT_ADDRESS,
            aquaAddress,
            usdcAddress,
          },
          (s) => {
            toast.loading(`BYOK: ${STEP_LABELS[s.step] || s.step}…`, { id: toastId });
          }
        );
        data = { ...result, scaledCostUSDC: scaledUsdc(usdcCost).toFixed(4) };
      } else {
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

        data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "On-chain transaction execution failed");
        }
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
              operator: isLive ? (selectedFlight?.originCountry ? `${selectedFlight.originCountry} Air Transport` : "Commercial Aviation") : (activeTrack?.airline || "Recorded Track"),
              origin: isLive ? "Origin Waypoint" : (activeTrack?.originAirport || "ENR"),
              destination: isLive ? "Destination Airport" : (activeTrack?.destinationAirport || "RADAR"),
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
      const replayHash =
        !isLive && activeTrack?.source !== "synthetic" && activeTrack?.fixCount
          ? hashRecording(
              (loadWatchedFlights().find((w) => `rec-${w.key}` === activeTrack.id)?.fixes) || []
            )
          : undefined;
      const cert: SettlementCertificateData = {
        flightId: data.flightId || `${callsign}-${Date.now()}`,
        callsign,
        airline: isLive
          ? (selectedFlight?.originCountry ? `${selectedFlight.originCountry} Commercial Airspace` : "Commercial Airspace")
          : (activeTrack?.airline || "Recorded Track"),
        airframe: isLive
          ? (selectedFlight?.equipmentType || (liveCategory === "HEAVY" ? "Heavy Widebody Jet" : "Commercial Jet"))
          : (activeTrack?.airframe || "Recorded ADS-B Track"),
        originAirport: isLive
          ? (selectedFlight?.originCountry ? selectedFlight.originCountry.slice(0, 3).toUpperCase() : "DEP")
          : (activeTrack?.originAirport || "ENR"),
        destinationAirport: isLive ? "RADAR" : (activeTrack?.destinationAirport || "RADAR"),
        destinationName: isLive ? "Live Airspace Track" : (activeTrack?.destinationName || "Recorded live airspace"),
        runway: isLive ? "ENROUTE" : (activeTrack?.runway || "--"),
        icao24: isLive ? (selectedFlight?.icao24 || "39DE4E") : (activeTrack?.icao24 || callsign.toLowerCase()),
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
        observedSeconds: !isLive ? activeTrack?.observedSeconds : undefined,
        fixCount: !isLive ? activeTrack?.fixCount : undefined,
        recordingHash: replayHash,
        trackSource: !isLive ? activeTrack?.source : undefined,
      };
      setCertificateData(cert);
      if (opts?.openCertificate !== false) {
        setIsCertificateOpen(true);
      }

      toast.success(
        isLive
          ? "Flight Leg Settled on Arc Testnet! ✈️"
          : "Wheels-Down Settled on Arc Testnet! 🛬",
        {
          id: toastId,
          description:
            opts?.openCertificate === false
              ? `${callsign} reconciled on-chain. Block #${data.blockNumber} (Gas: ${data.gasUsed}). Certificate ready under Audit.`
              : `${callsign} reconciled on-chain. Block #${data.blockNumber} (Gas: ${data.gasUsed}).`,
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
        : (activeTrack?.callsign || "RECORDED-TRACK");
      setCertificateData({
        flightId: `${callsign}-DOC9889`,
        callsign,
        airline: isLive
          ? (selectedFlight?.originCountry ? `${selectedFlight.originCountry} Airspace` : "Commercial Airspace")
          : (activeTrack?.airline || "Recorded Track"),
        airframe: isLive
          ? (selectedFlight?.equipmentType || "Commercial Jet")
          : (activeTrack?.airframe || "Recorded ADS-B Track"),
        originAirport: isLive
          ? (selectedFlight?.originCountry ? selectedFlight.originCountry.slice(0, 3).toUpperCase() : "DEP")
          : (activeTrack?.originAirport || "ENR"),
        destinationAirport: isLive ? "RADAR" : (activeTrack?.destinationAirport || "RADAR"),
        destinationName: isLive ? "Live Airspace Sector" : (activeTrack?.destinationName || "Recorded live airspace"),
        runway: isLive ? "ENROUTE" : (activeTrack?.runway || "--"),
        icao24: isLive ? (selectedFlight?.icao24 || "39DE4E") : (activeTrack?.icao24 || "39DE4E"),
        airborneSeconds: isLive ? 3600 : (activeTrack?.plannedAirborneSeconds || 0),
        fuelBurnKg,
        co2Kg,
        costUSDC: usdcCost,
        scaledCostUSDC: scaledUsdc(usdcCost).toFixed(4),
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

  // Replay Playback Timer (speed-scaled; settlement guards prevent duplicate fires)
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
          // Autoplay: settle without popping the certificate over the replay.
          triggerWheelsDownSettlement(currentFrame, { openCertificate: false });
        }

        return next;
      });
    }, Math.max(225, Math.round(1800 / Math.min(Math.max(playbackSpeed, 1), 8))));

    return () => clearInterval(interval);
  }, [mode, isPlaying, activeReplayFrames, isSettled, isSettling, playbackSpeed]);

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
    const tdIdx = activeTrack?.touchdownIndex ?? (activeReplayFrames.length - 4);
    setReplayIndex(tdIdx);
    setIsPlaying(false);
    if (!isSettled && !isSettling) {
      triggerWheelsDownSettlement(activeReplayFrames[tdIdx]);
    }
  };

  // 2D selection ↔ watch/arm derivation (drives card buttons + map tinting).
  const selectedWatchEntry =
    mode === "live" && selectedFlight
      ? watched.find(
          (w) =>
            w.key === (selectedFlight.icao24 || selectedFlight.callsign).toLowerCase() ||
            w.callsign.toLowerCase() === selectedFlight.callsign.toLowerCase()
        )
      : undefined;
  const isSelectedArmed =
    mode === "live" && selectedFlight && armedFlightCallsign
      ? armedFlightCallsign === selectedFlight.callsign.toLowerCase() ||
        armedFlightCallsign === (selectedFlight.icao24 || "").toLowerCase()
      : false;

  return (
    <div className="h-screen w-full bg-[#ECEBE6] text-[#111111] font-sans flex overflow-hidden select-none">
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
        onOpenByok={() => setIsByokOpen(true)}
        byokActive={Boolean(byokKey)}
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
          scenario={activeTrack}
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
          scaledCostUSDC={scaledUsdc(usdcCost).toFixed(4)}
          treasuryBalance={treasuryBalance}
          isBalanceLoading={isBalanceLoading}
          totalCarbonCredits={totalCarbonCredits}
          isCreditsLoading={isCreditsLoading}
          onOpenCommandSearch={() => setIsCommandOpen(true)}
          className="h-full"
          isWatched={Boolean(selectedWatchEntry)}
          isArmed={isSelectedArmed}
          watchFixCount={selectedWatchEntry?.fixes.length || 0}
          onToggleWatch={handleToggleWatch}
          onToggleArm={handleToggleArmSettlement}
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
              armedCallsign={armedFlightCallsign}
              onDisarm={() => disarmSettlement()}
              treasuryAddress={byokKey && byokAddress ? byokAddress : activeWalletAddress}
              selectedCallsign={selectedFlight?.callsign}
              byokKey={byokKey}
              onSettlementSuccess={(txHash, flight) => {
                fetchBalance();
                fetchCarbonCredits();
              }}
              onReplayRecording={(trackId) => {
                selectTrack(trackId);
                switchMode("replay");
              }}
            />
          </div>
        ) : mode === "replay" && !activeTrack ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center p-8 border border-[#D4D3CD] rounded-xl bg-[#D6D5CF]">
            <div className="font-sans text-sm font-semibold text-[#111111]">
              No replay track available
            </div>
            <div className="text-xs text-[#555555] font-sans leading-relaxed max-w-sm">
              Replay plays real recorded ADS-B: never fabricated telemetry. Watch
              a live flight on the 2D radar to record its path, or wait for the
              bundled demo track.
            </div>
            <button
              type="button"
              onClick={() => switchMode("live")}
              className="btn-pill mt-1 px-4 py-2 bg-[#111111] hover:bg-[#FF4D00] text-xs text-[#ECEBE6] cursor-pointer transition-colors font-sans"
            >
              Back to Live Radar
            </button>
          </div>
        ) : (
          <div className="relative w-full h-full overflow-hidden border border-[#D4D3CD] rounded-xl bg-[#ECEBE6]">
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
                  const tdIdx = activeTrack?.touchdownIndex ?? (activeReplayFrames.length - 4);
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
                playbackSpeed={playbackSpeed}
                onSpeedChange={setPlaybackSpeed}
                trackSource={mode === "replay" ? activeTrack?.source : undefined}
                trackLabel={mode === "replay" ? activeTrack?.callsign : undefined}
              />
            </div>

            {/* Real-flight track list (replay mode): recorded landings with
                real takeoff/touchdown leg data; click selects, the single
                timeline Settle button settles the selected track. */}
            {mode === "replay" && playableTracks.length > 0 && (
              <div className="absolute left-3 top-[76px] z-30 w-72 max-w-[calc(100%-24px)] max-h-[calc(100%-180px)] overflow-y-auto bg-[#ECEBE6]/95 backdrop-blur-md rounded-xl border border-[#D4D3CD] shadow-lg">
                <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[#555555] border-b border-[#D4D3CD] sticky top-0 bg-[#ECEBE6]">
                  Landed Flights · Real Tracks ({playableTracks.length})
                </div>
                {playableTracks.slice(0, 6).map((t) => {
                  const selected = t.id === activeTrack?.id;
                  const leg = t.leg;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTrack(t.id)}
                      className={`w-full text-left px-3 py-2.5 border-b border-[#D4D3CD] transition-colors cursor-pointer ${
                        selected ? "bg-[#D6D5CF]" : "hover:bg-[#D6D5CF]/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#111111]">
                          {t.callsign}
                        </span>
                        <span className="btn-pill px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#ECEBE6] text-[#555555] border border-[#D4D3CD]">
                          {t.source === "synthetic"
                            ? "SYNTHETIC FIXTURE"
                            : t.source === "bundled"
                            ? "RECORDED · DEMO"
                            : t.autoRecorded
                            ? t.inProgress
                              ? `AUTO · RECORDING · ${t.fixCount || 0} FIXES`
                              : `AUTO · RECORDED · ${t.fixCount || 0} FIXES`
                            : t.inProgress
                            ? `RECORDING · ${t.fixCount || 0} FIXES`
                            : `RECORDED · ${t.fixCount || 0} FIXES`}
                        </span>
                        {selected && (
                          <span className="ml-auto w-2 h-2 rounded-full bg-[#FF4D00] animate-pulse shrink-0" />
                        )}
                      </div>
                      <div className="text-[10.5px] font-mono text-[#555555] mt-1">
                        {leg?.depAirport || leg?.firstSeen ? (
                          <span>
                            TO {leg?.depAirport || "???"} {fmtZuluHM(leg?.firstSeen)} → TD{" "}
                            {leg?.arrAirport || "???"} {fmtZuluHM(leg?.lastSeen)}
                          </span>
                        ) : (
                          <span>
                            Observed {Math.round((t.observedSeconds || 0) / 60)} min ·{" "}
                            {t.fixCount || 0} fixes (partial segment)
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* About-to-land filter (live mode): descending + near hub, ranked
                by smoothed-VSI ETA. Watch seeds past positions (buffer +
                OpenSky track backfill) so replay shows the full trajectory;
                after replay finishes, settle from the timeline button. */}
            {mode === "live" && (
              <div className="absolute left-3 top-[76px] z-30 w-72 max-w-[calc(100%-24px)] max-h-[calc(100%-180px)] overflow-y-auto bg-[#ECEBE6]/95 backdrop-blur-md rounded-xl border border-[#D4D3CD] shadow-lg">
                <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[#555555] border-b border-[#D4D3CD] sticky top-0 bg-[#ECEBE6]">
                  About to Land · Live Filter ({landingCandidates.length})
                </div>
                {/* Active watches: always visible so a selected flight never
                    seems to vanish — recording count, landing state, signal. */}
                {watched.filter((w) => w.status === "WATCHING").map((w) => {
                  const lost = signalLostKeys.includes(w.key);
                  return (
                    <div
                      key={`watching-${w.key}`}
                      className="px-3 py-2.5 border-b border-[#D4D3CD] bg-[#D6D5CF]/60"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#111111]">
                          {w.callsign}
                        </span>
                        <span
                          className={`btn-pill px-1.5 py-0.5 text-[9px] font-mono font-bold border ${
                            lost
                              ? "bg-[#ECEBE6] text-[#FF4D00] border-[#FF4D00]"
                              : "bg-[#111111] text-[#ECEBE6] border-[#111111]"
                          }`}
                        >
                          {lost ? "SIGNAL LOST" : `RECORDING · ${w.fixes.length} FIXES`}
                        </span>
                      </div>
                      <div className="text-[10.5px] font-mono text-[#555555] mt-1">
                        {lost
                          ? "Coverage gap — recording kept, replay preview in Replay tab."
                          : "Recording every radar poll — replay unlocks fully at touchdown."}
                      </div>
                    </div>
                  );
                })}
                {landingCandidates.length === 0 && (
                  <div className="px-3 py-3 text-[11px] font-mono text-[#555555] leading-relaxed">
                    {isLiveLoading
                      ? "Scanning descent profiles…"
                      : "No descending arrivals near FRA/CDG/LHR/AMS right now. Watch any airborne flight instead."}
                  </div>
                )}
                {landingCandidates.map((c) => {
                  const wk =
                    c.flight.icao24?.toLowerCase() === selectedFlight?.icao24?.toLowerCase() ||
                    c.flight.callsign.toLowerCase() === selectedFlight?.callsign?.toLowerCase();
                  const alreadyWatched = watchedKeys.some(
                    (k) =>
                      k === (c.flight.icao24 || "").toLowerCase() ||
                      k === c.flight.callsign.toLowerCase()
                  );
                  return (
                    <div
                      key={`${c.flight.icao24}-${c.flight.callsign}`}
                      className={`w-full text-left px-3 py-2.5 border-b border-[#D4D3CD] ${wk ? "bg-[#D6D5CF]" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedFlight(c.flight)}
                        className="w-full text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#111111]">
                            {c.flight.callsign}
                          </span>
                          <span className="btn-pill px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#ECEBE6] text-[#555555] border border-[#D4D3CD]">
                            → {c.hubIata}
                          </span>
                          {c.etaMin != null && (
                            <span className="ml-auto font-mono text-[10px] font-bold text-[#FF4D00] tabular-nums shrink-0">
                              ~{c.etaMin} min
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] font-mono text-[#555555] mt-1 tabular-nums">
                          {Math.round(c.altM * 3.28084).toLocaleString()} ft ·{" "}
                          {c.vsiSmoothedMps.toFixed(1)} m/s · {c.distKm} km to {c.hubIata}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFlight(c.flight);
                          void handleToggleWatch(c.flight.callsign);
                        }}
                        disabled={alreadyWatched}
                        className={`btn-pill mt-1.5 w-full py-1.5 font-mono text-[11px] font-semibold border transition-[transform,opacity,background-color] duration-140 active:scale-[0.98] cursor-pointer ${
                          alreadyWatched
                            ? "bg-[#D6D5CF] border-[#D4D3CD] text-[#555555]"
                            : "bg-[#111111] border-[#111111] text-[#ECEBE6] hover:bg-[#FF4D00] hover:border-[#FF4D00]"
                        }`}
                      >
                        {alreadyWatched ? "Watching · replay at touchdown" : "Watch + record full track"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Fullscreen Map Canvas (2D Leaflet Radar only on this branch) */}
            <div className="w-full h-full">
                <WindyFlightMap
                  mode={mode}
                  liveFlights={liveFlights}
                  selectedFlight={activeData}
                  replayFrame={mode === "replay" ? activeReplayFrame : null}
                  replayTrack={mode === "replay" ? activeReplayFrames : []}
                  destinationLabel={
                    mode === "replay"
                      ? `${activeTrack?.destinationAirport || "RADAR"} Runway ${activeTrack?.runway || "--"}`
                      : undefined
                  }
                  onSelectFlight={(flight) => {
                    setSelectedFlight(flight as LiveFlightSummary);
                  }}
                  watchedKeys={watchedKeys}
                  armedKey={armedFlightCallsign}
                />
            </div>

            {/* Bottom Left: Mode Switcher (Live vs Replay) */}
            <div className="absolute bottom-3 left-3 z-30 pointer-events-auto flex items-center gap-2">
              <div className="bg-[#ECEBE6]/95 backdrop-blur-md p-1 rounded-full border border-[#D4D3CD] shadow-sm flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => switchMode("replay")}
                  className={`btn-pill px-3 py-1 font-sans text-xs transition-colors cursor-pointer ${
                    mode === "replay"
                      ? "bg-[#111111] text-[#ECEBE6] font-semibold"
                      : "text-[#555555] hover:text-[#111111]"
                  }`}
                >
                   Replay Track
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("live")}
                  className={`btn-pill px-3 py-1 font-sans text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                    mode === "live"
                      ? "bg-[#111111] text-[#ECEBE6] font-semibold"
                      : "text-[#555555] hover:text-[#111111]"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#FF4D00] animate-pulse" />
                  <span>Live Radar</span>
                </button>
              </div>
            </div>

          {/* Bottom Right: Avionics & Telemetry Integrity Expandable Drawer */}
          <div className="absolute bottom-3 right-3 z-30 flex flex-col items-end pointer-events-auto">
            {/* Expandable Drawer Panel */}
            {isIntegrityOpen && (
              <div className="mb-2 w-[420px] max-w-[calc(100vw-48px)] bg-[#ECEBE6]/95 backdrop-blur-md border border-[#D4D3CD] rounded-xl shadow-lg p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-140">
                {/* Tab Selector */}
                <div className="flex items-center justify-between border-b border-[#D4D3CD] pb-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveIntegrityTab("fuel")}
                      className={`btn-pill px-3 py-1 font-sans text-xs transition-colors cursor-pointer ${
                        activeIntegrityTab === "fuel"
                          ? "bg-[#111111] text-[#ECEBE6] font-semibold"
                          : "text-[#555555] hover:text-[#111111]"
                      }`}
                    >
                      Fuel Flow Dynamics
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveIntegrityTab("integrity")}
                      className={`btn-pill px-3 py-1 font-sans text-xs transition-colors cursor-pointer ${
                        activeIntegrityTab === "integrity"
                          ? "bg-[#111111] text-[#ECEBE6] font-semibold"
                          : "text-[#555555] hover:text-[#111111]"
                      }`}
                    >
                      Settlement Integrity
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsIntegrityOpen(false)}
                    aria-label="Collapse Panel"
                    className="icon-circle text-[#555555] hover:text-[#111111] p-1 cursor-pointer transition-colors"
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
                    runway={mode === "replay" ? (activeTrack?.runway || "--") : "25L"}
                    destinationAirport={mode === "replay" ? (activeTrack?.destinationAirport || "RADAR") : "EDDF"}
                  />
                )}
              </div>
            )}

            {/* Toggle Button */}
            <button
              type="button"
              onClick={() => setIsIntegrityOpen((prev) => !prev)}
              className="btn-pill px-3.5 py-1.5 bg-[#ECEBE6]/95 backdrop-blur-md border border-[#D4D3CD] shadow-sm flex items-center gap-2 text-xs font-sans text-[#111111] hover:text-[#FF4D00] cursor-pointer transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-[#FF4D00]" />
              <span>Avionics & Telemetry Integrity</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D00] animate-pulse" />
              {isIntegrityOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#555555]" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-[#555555]" />
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
        tracks={playableTracks}
        onSelectTrack={(track) => {
          selectTrack(track.id);
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
      {/* ── 8. BYOK SELF-TESTING PANEL (Track: permissionless demo) ── */}
      <ByokPanel
        isOpen={isByokOpen}
        onClose={() => setIsByokOpen(false)}
        activeAddress={byokAddress}
        onActivate={(key) => {
          setByokKey(key);
          setIsByokOpen(false);
        }}
        onForget={() => setByokKey(null)}
      />
    </div>
  );
}
