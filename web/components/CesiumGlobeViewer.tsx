"use client";

import React, { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { FlightTrackerApp } from "@/lib/flight-tracker-app";
import { AircraftMeta } from "@/lib/flight-layer";
import { AircraftEnrichment } from "@/lib/adsbdb-queue";
import {
  resolveAirframe,
  computeInstantaneousEmissions,
  AirframeProfile,
} from "@/lib/icao-precision";
import {
  Globe2,
  Crosshair,
  Compass,
  Plane,
  Radio,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Leaf,
  Layers,
  ShieldCheck,
} from "lucide-react";

interface CesiumGlobeViewerProps {
  onSelectFlight?: (meta: AircraftMeta | null, enrichment: AircraftEnrichment | null) => void;
  onArmedTouchdown?: (meta: AircraftMeta) => void;
  selectedIcao?: string | null;
  armedIcao?: string | null;
  onToggleArm?: (icao: string) => void;
  onSwitchToLandedTab?: () => void;
  landedCount?: number;
  initialAircraftLimit?: number;
  onAircraftLimitChange?: (limit: number) => void;
}

export default function CesiumGlobeViewer({
  onSelectFlight,
  onArmedTouchdown,
  selectedIcao,
  armedIcao,
  onToggleArm,
  onSwitchToLandedTab,
  landedCount = 0,
  initialAircraftLimit = 25,
  onAircraftLimitChange,
}: CesiumGlobeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const trackerAppRef = useRef<FlightTrackerApp | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [activeMeta, setActiveMeta] = useState<AircraftMeta | null>(null);
  const [activeEnrichment, setActiveEnrichment] = useState<AircraftEnrichment | null>(null);
  const [airframe, setAirframe] = useState<AirframeProfile | null>(null);
  const [flightCounts, setFlightCounts] = useState({ airborne: 0, landed: 0 });
  const [isFollowing, setIsFollowing] = useState(true);
  const [aircraftLimit, setAircraftLimit] = useState(initialAircraftLimit);

  // Setup client mount gate
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!isMounted || !containerRef.current || viewerRef.current) return;

    // Set Cesium base URL to point to static assets
    (window as any).CESIUM_BASE_URL = "/cesium";

    // ESRI Dark Gray Canvas tiles for sleek night avionics radar aesthetic (zero-key, high-availability)
    const darkImagery = new Cesium.UrlTemplateImageryProvider({
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      maximumLevel: 16,
    });

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: new Cesium.ImageryLayer(darkImagery),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      timeline: false,
      animation: false,
      fullscreenButton: false,
      selectionIndicator: false,
      creditContainer: document.createElement("div"), // Hide attribution clutter
      scene3DOnly: true,
      requestRenderMode: false,
    });

    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#1e2528");
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#1e2528");
    viewer.scene.globe.enableLighting = false;

    // Initial camera view over North Atlantic / Europe / US flight corridor
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-30.0, 48.0, 12000000.0),
      orientation: {
        heading: 0.0,
        pitch: Cesium.Math.toRadians(-80.0),
        roll: 0.0,
      },
    });

    const tracker = new FlightTrackerApp(viewer, {
      onAircraftSelected: (meta, enrichment) => {
        setActiveMeta(meta);
        setActiveEnrichment(enrichment || null);
        if (meta) {
          setIsFollowing(true);
          const profile = resolveAirframe(enrichment?.type, meta.callsign);
          setAirframe(profile);
        } else {
          setIsFollowing(false);
          setAirframe(null);
        }
        onSelectFlight?.(meta, enrichment || null);
      },
      onAircraftTouchdown: (meta) => {
        onArmedTouchdown?.(meta);
      },
      onFlightsUpdated: (airborne, landed) => {
        setFlightCounts({ airborne, landed });
      },
    });

    tracker.setMaxAircraftLimit(aircraftLimit);
    tracker.start();

    viewerRef.current = viewer;
    trackerAppRef.current = tracker;
    if (typeof window !== "undefined") {
      (window as any).__flightTrackerApp = tracker;
      (window as any).__cesiumViewer = viewer;
    }

    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__flightTrackerApp;
        delete (window as any).__cesiumViewer;
      }
      tracker.stop();
      viewer.destroy();
      viewerRef.current = null;
      trackerAppRef.current = null;
    };
  }, [isMounted]);

  // Synchronize aircraftLimit updates to live tracker app
  useEffect(() => {
    if (trackerAppRef.current) {
      trackerAppRef.current.setMaxAircraftLimit(aircraftLimit);
    }
  }, [aircraftLimit]);

  // Handle external selection changes
  useEffect(() => {
    if (!trackerAppRef.current) return;
    if (selectedIcao && selectedIcao.toLowerCase() !== trackerAppRef.current.trackedIcao?.toLowerCase()) {
      setIsFollowing(true);
      trackerAppRef.current.trackAircraft(selectedIcao);
    } else if (!selectedIcao && trackerAppRef.current.trackedIcao) {
      setIsFollowing(false);
      trackerAppRef.current.untrack();
      setActiveMeta(null);
      setActiveEnrichment(null);
      setAirframe(null);
    }
  }, [selectedIcao]);

  // Compute live ICAO emissions if active aircraft exists
  const liveEmissions = activeMeta && airframe
    ? computeInstantaneousEmissions(
        {
          altitudeM: activeMeta.altitudeM,
          verticalRateMps: activeMeta.verticalRateMps,
          speedMps: activeMeta.velocityMps,
          onGround: activeMeta.onGround,
        },
        airframe
      )
    : null;

  const isArmed = activeMeta && armedIcao === activeMeta.callsign.toLowerCase();

  const handleResetCamera = () => {
    if (!viewerRef.current) return;
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-30.0, 48.0, 12000000.0),
      orientation: {
        heading: 0.0,
        pitch: Cesium.Math.toRadians(-80.0),
        roll: 0.0,
      },
      duration: 1.5,
    });
    trackerAppRef.current?.untrack();
    setIsFollowing(false);
    setActiveMeta(null);
    onSelectFlight?.(null, null);
  };

  const handleToggleFollow = () => {
    if (!viewerRef.current || !activeMeta || !trackerAppRef.current) return;
    const nextFollow = !isFollowing;
    setIsFollowing(nextFollow);
    trackerAppRef.current.setFollowing(nextFollow);
    if (nextFollow && activeMeta.icao24) {
      trackerAppRef.current.trackAircraft(activeMeta.icao24);
    }
  };

  if (!isMounted) {
    return (
      <div className="w-full h-full min-h-[600px] flex items-center justify-center bg-[#1e2528] text-[#a7c080] font-mono text-xs border border-dashed border-[#d3c6aa]/16">
        <div className="flex flex-col items-center gap-3">
          <Globe2 className="w-8 h-8 animate-spin text-[#a7c080]/60" />
          <span className="tracking-widest uppercase">Initializing 3D Digital Globe Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[640px] overflow-hidden border border-dashed border-[#d3c6aa]/16 bg-[#1e2528]">
      {/* Cesium WebGL Container */}
      <div ref={containerRef} className="w-full h-full absolute inset-0 cursor-crosshair" />

      {/* Top Left: 3D Global Telemetry Status HUD */}
      <div className="absolute top-16 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-3 bg-[#1e2528]/90 backdrop-blur-md px-3.5 py-2 border border-dashed border-[#d3c6aa]/16 pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#a7c080] blink-step" />
            <span className="font-mono text-xs font-semibold text-[#d3c6aa] tracking-wider">
              3D DIGITAL GLOBE (ICAO / ADS-B)
            </span>
          </div>

          <div className="h-3 w-px bg-[#d3c6aa]/15" />

          <div className="flex items-center gap-2 font-mono text-[11px] text-[#9daaa4]">
            <Radio className="w-3.5 h-3.5 text-[#a7c080]" />
            <span>Airborne: <strong className="text-[#d3c6aa]">{flightCounts.airborne}</strong></span>
          </div>

          <div className="h-3 w-px bg-[#d3c6aa]/15" />

          {/* Quick link to Landed Queue */}
          <button
            onClick={onSwitchToLandedTab}
            className="flex items-center gap-1.5 font-mono text-[11px] text-[#dbbc7f] hover:text-[#d3c6aa] transition-[transform,opacity] duration-140 active:scale-95 px-2 py-0.5 bg-[#dbbc7f]/10 border border-dashed border-[#dbbc7f]/30"
          >
            <span>Landed Unsettled:</span>
            <strong className="text-[#dbbc7f] underline">{landedCount || flightCounts.landed}</strong>
          </button>
        </div>

        <div className="text-[10px] font-mono text-[#859289] bg-[#1e2528]/80 px-2.5 py-1 backdrop-blur-sm self-start border border-dashed border-[#d3c6aa]/[0.08]">
          Datum: WGS84 + EGM96 Geoid • 30s Kinematic ENU Lerp • 1 Draw-Call Batch
        </div>
      </div>

      {/* Top Right: View Controls & Density Slider */}
      <div className="absolute top-16 right-4 z-10 flex items-center gap-2 pointer-events-auto">
        {/* Airplane Density Slider */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2528]/90 backdrop-blur-md border border-dashed border-[#d3c6aa]/16 text-xs font-mono text-[#9daaa4]">
          <Plane className="w-3.5 h-3.5 text-[#a7c080]" />
          <span className="text-[11px] text-[#859289] hidden sm:inline">Fleet Density:</span>
          <span className="font-bold text-[#a7c080] tabular-nums min-w-[20px] text-center">{aircraftLimit}</span>
          <input
            type="range"
            min="10"
            max="60"
            step="5"
            value={aircraftLimit}
            onChange={(e) => {
              const val = Number(e.target.value);
              setAircraftLimit(val);
              trackerAppRef.current?.setMaxAircraftLimit(val);
              onAircraftLimitChange?.(val);
            }}
            className="w-20 h-1.5 bg-[#475258] appearance-none cursor-pointer accent-[#a7c080]"
            title={`Adjust fleet density: ${aircraftLimit} airplanes`}
          />
        </div>

        <button
          onClick={handleResetCamera}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2528]/90 backdrop-blur-md border border-dashed border-[#d3c6aa]/16 text-xs font-mono text-[#9daaa4] hover:text-[#d3c6aa] hover:border-[#a7c080]/50 transition-[transform,opacity] duration-140 active:scale-95"
          title="Reset Global View"
        >
          <Compass className="w-3.5 h-3.5 text-[#a7c080]" />
          <span>Reset Orbit</span>
        </button>

        {activeMeta && (
          <button
            onClick={handleToggleFollow}
            className={`flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-md border text-xs font-mono transition-[transform,opacity] duration-140 active:scale-95 ${
              isFollowing
                ? "bg-[#a7c080]/20 border-dashed border-[#a7c080]/50 text-[#a7c080]"
                : "bg-[#1e2528]/90 border-dashed border-[#d3c6aa]/16 text-[#9daaa4] hover:text-[#d3c6aa]"
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{isFollowing ? "Tracking Lock" : "Free Cam"}</span>
          </button>
        )}
      </div>

      {/* Bottom Center / Right: Active Aircraft Telemetry HUD */}
      {activeMeta && airframe && liveEmissions && (
        <div className="absolute bottom-20 left-6 right-6 md:left-auto md:right-6 md:w-[420px] z-10 bg-[#1e2528]/95 backdrop-blur-md border border-dashed border-[#d3c6aa]/20 p-4 transition-[transform,opacity] duration-180 animate-in fade-in slide-in-from-bottom-3">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-dashed border-[#d3c6aa]/16">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#a7c080]/10 border border-dashed border-[#a7c080]/40 text-[#a7c080]">
                <Plane className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-[#d3c6aa] tracking-wide">
                    {activeMeta.callsign}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-[#d3c6aa]/10 text-[#9daaa4]">
                    {airframe.model}
                  </span>
                </div>
                <div className="text-[11px] text-[#859289] font-mono">
                  {airframe.manufacturer} ({airframe.category}) • {activeEnrichment?.operator || "Commercial Carrier"}
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div
              className={`px-2.5 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider border-dashed ${
                activeMeta.onGround
                  ? "bg-[#dbbc7f]/20 border-[#dbbc7f]/50 text-[#dbbc7f]"
                  : liveEmissions.phase === "CLIMB"
                  ? "bg-[#7fbbb3]/20 border-[#7fbbb3]/50 text-[#7fbbb3]"
                  : liveEmissions.phase === "CRUISE"
                  ? "bg-[#a7c080]/20 border-[#a7c080]/50 text-[#a7c080]"
                  : "bg-[#dbbc7f]/20 border-[#dbbc7f]/50 text-[#dbbc7f]"
              }`}
            >
              {liveEmissions.phase}
            </div>
          </div>

          {/* Telemetry Avionics Grid */}
          <div className="grid grid-cols-3 gap-2 my-3 font-mono">
            <div className="bg-[#2d353b]/60 p-2 border border-dashed border-[#d3c6aa]/[0.08]">
              <div className="text-[10px] text-[#859289]">Altitude (MSL)</div>
              <div className="text-sm font-bold text-[#d3c6aa] tabular-nums">
                {Math.round(activeMeta.altitudeM).toLocaleString()}m
              </div>
              <div className="text-[9px] text-[#859289] tabular-nums">
                ~{Math.round(activeMeta.altitudeM * 3.28084).toLocaleString()} ft
              </div>
            </div>

            <div className="bg-[#2d353b]/60 p-2 border border-dashed border-[#d3c6aa]/[0.08]">
              <div className="text-[10px] text-[#859289]">Ground Speed</div>
              <div className="text-sm font-bold text-[#d3c6aa] tabular-nums">
                {Math.round(activeMeta.velocityMps * 1.94384)} kts
              </div>
              <div className="text-[9px] text-[#859289] tabular-nums">
                {Math.round(activeMeta.velocityMps)} m/s
              </div>
            </div>

            <div className="bg-[#2d353b]/60 p-2 border border-dashed border-[#d3c6aa]/[0.08]">
              <div className="text-[10px] text-[#859289]">Vertical Rate</div>
              <div
                className={`text-sm font-bold tabular-nums ${
                  activeMeta.verticalRateMps > 1
                    ? "text-[#7fbbb3]"
                    : activeMeta.verticalRateMps < -1
                    ? "text-[#dbbc7f]"
                    : "text-[#9daaa4]"
                }`}
              >
                {activeMeta.verticalRateMps > 0 ? "+" : ""}
                {activeMeta.verticalRateMps.toFixed(1)} m/s
              </div>
              <div className="text-[9px] text-[#859289] tabular-nums">
                {(activeMeta.verticalRateMps * 196.85).toFixed(0)} fpm
              </div>
            </div>
          </div>

          {/* Precision ICAO & SwapVM Fuel Dynamics */}
          <div className="p-2.5 bg-[#a7c080]/[0.06] border border-dashed border-[#a7c080]/25 flex flex-col gap-1.5 font-mono mb-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[#9daaa4]">
                <Flame className="w-3.5 h-3.5 text-[#e69875]" />
                <span>Fuel Burn:</span>
              </div>
              <span className="font-bold text-[#d3c6aa] tabular-nums">
                {liveEmissions.fuelBurnKgPerSec.toFixed(2)} kg/s
                <span className="text-[#859289] font-normal text-[10px]">
                  {" "}
                  ({(liveEmissions.fuelBurnKgPerSec * 3600).toFixed(0)} kg/h)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[#9daaa4]">
                <Leaf className="w-3.5 h-3.5 text-[#a7c080]" />
                <span>CO₂ Emitted (3.16x):</span>
              </div>
              <span className="font-bold text-[#a7c080] tabular-nums">
                {liveEmissions.co2KgPerSec.toFixed(2)} kg/s
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#859289] pt-1 border-t border-dashed border-[#a7c080]/20">
              <span>SwapVM Altitude Curve:</span>
              <span className="text-[#a7c080] font-semibold tabular-nums">
                {liveEmissions.curveMultiplier.toFixed(2)}x factor
              </span>
            </div>
          </div>

          {/* Action Trigger Row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleArm?.(activeMeta.callsign.toLowerCase())}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 font-mono text-xs font-semibold transition-[transform,opacity] duration-140 active:scale-[0.98] border-dashed ${
                isArmed
                  ? "bg-[#a7c080]/20 border-[#a7c080] text-[#a7c080] hover:bg-[#a7c080]/30"
                  : "bg-[#d3c6aa]/10 border-[#d3c6aa]/25 text-[#d3c6aa] hover:bg-[#d3c6aa]/20"
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isArmed ? "text-[#a7c080] fill-[#a7c080]" : "text-[#dbbc7f]"}`} />
              <span>
                {isArmed
                  ? "ARMED: Settle on Touchdown"
                  : "Arm Auto-Settle on Landing"}
              </span>
            </button>

            <button
              onClick={onSwitchToLandedTab}
              className="py-2.5 px-3 bg-[#2d353b] hover:bg-[#343f44] border border-dashed border-[#d3c6aa]/16 text-xs font-mono text-[#9daaa4] hover:text-[#d3c6aa] transition-[transform,opacity] duration-140 active:scale-[0.98]"
              title="Open Landed Settlements Tab"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
