"use client";

import { useEffect, useRef } from "react";
import type { LiveFlightSummary } from "../app/api/live-flights/route";

interface ReplayFrame {
  callsign: string;
  latitude: number;
  longitude: number;
  baroAltitudeMeters: number;
  velocityMps: number;
  verticalRateMps: number;
  onGround: boolean;
  trueTrackDeg: number;
}

interface WindyFlightMapProps {
  mode: "live" | "replay";
  liveFlights: LiveFlightSummary[];
  selectedFlight: LiveFlightSummary | ReplayFrame | null;
  replayFrame: ReplayFrame | null;
  replayTrack: ReplayFrame[];
  onSelectFlight: (flight: LiveFlightSummary | ReplayFrame) => void;
}

export default function WindyFlightMap({
  mode,
  liveFlights,
  selectedFlight,
  replayFrame,
  replayTrack,
  onSelectFlight,
}: WindyFlightMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const replayPolylineRef = useRef<any>(null);
  const replayMarkerRef = useRef<any>(null);

  // Initialize Leaflet map
  useEffect(() => {
    let isMounted = true;
    const container = mapContainerRef.current;
    if (!container) return;

    // Guard against React 18/19 StrictMode double-initialization
    if (mapInstanceRef.current || (container as any)._leaflet_id) {
      return;
    }

    // Dynamically load Leaflet
    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current || (mapContainerRef.current as any)._leaflet_id) {
        return;
      }

      const map = L.map(mapContainerRef.current, {
        center: [50.0333, 8.5706], // Centered around Frankfurt / Central Europe
        zoom: 5,
        minZoom: 3,
        maxZoom: 14,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Esri World Dark Gray Canvas tile layer (100% free, zero API key required)
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ | OpenSky Network ADS-B",
          maxZoom: 16,
        }
      ).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (container && (container as any)._leaflet_id) {
        delete (container as any)._leaflet_id;
      }
    };
  }, []);

  // Update Live Flight Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || mode !== "live") return;

    import("leaflet").then((L) => {
      markersLayerRef.current.clearLayers();

      liveFlights.forEach((flight) => {
        const isSelected = selectedFlight?.callsign === flight.callsign;
        const color = isSelected ? "#F8FAFC" : "#4C63ED";
        const stroke = isSelected ? "#4C63ED" : "#1E293B";

        const iconHtml = `
          <div style="transform: rotate(${flight.trueTrackDeg}deg); width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.3s ease;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="${color}" stroke="${stroke}" stroke-width="1.5">
              <path d="M12 2L15 9L22 11L15 14L15 20L12 18L9 20L9 14L2 11L9 9Z" />
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "plane-marker",
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const marker = L.marker([flight.latitude, flight.longitude], { icon: customIcon });

        marker.on("click", () => {
          onSelectFlight(flight);
        });

        marker.bindTooltip(
          `<strong>${flight.callsign}</strong><br/>FL${Math.round(flight.baroAltitudeMeters / 30.48)} | ${Math.round(flight.velocityMps * 1.944)} kts`,
          { direction: "top", offset: [0, -10], opacity: 0.9 }
        );

        markersLayerRef.current.addLayer(marker);
      });
    });
  }, [liveFlights, mode, selectedFlight, onSelectFlight]);

  // Update Replay Flight & Flight Track Polyline
  useEffect(() => {
    if (!mapInstanceRef.current || mode !== "replay") {
      if (replayPolylineRef.current) {
        replayPolylineRef.current.remove();
        replayPolylineRef.current = null;
      }
      if (replayMarkerRef.current) {
        replayMarkerRef.current.remove();
        replayMarkerRef.current = null;
      }
      return;
    }

    import("leaflet").then((L) => {
      if (markersLayerRef.current) {
        markersLayerRef.current.clearLayers();
      }

      // Draw flight track polyline
      if (replayTrack.length > 0 && !replayPolylineRef.current) {
        const latLngs = replayTrack.map((f) => [f.latitude, f.longitude]);
        const polyline = L.polyline(latLngs as any, {
          color: "#4C63ED",
          weight: 3,
          opacity: 0.6,
          dashArray: "6, 6",
        }).addTo(mapInstanceRef.current);
        replayPolylineRef.current = polyline;

        // Fit map view to track
        mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [60, 60] });
      }

      // Draw active replay plane
      if (replayFrame) {
        const iconColor = replayFrame.onGround ? "#10B981" : "#4C63ED";
        const iconHtml = `
          <div style="transform: rotate(${replayFrame.trueTrackDeg}deg); width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 0 10px rgba(76, 99, 237, 0.6));">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="${iconColor}" stroke="#F8FAFC" stroke-width="1.5">
              <path d="M12 2L15 9L22 11L15 14L15 20L12 18L9 20L9 14L2 11L9 9Z" />
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "replay-plane-marker",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        if (!replayMarkerRef.current) {
          const marker = L.marker([replayFrame.latitude, replayFrame.longitude], {
            icon: customIcon,
            zIndexOffset: 1000,
          }).addTo(mapInstanceRef.current);
          replayMarkerRef.current = marker;
        } else {
          replayMarkerRef.current.setLatLng([replayFrame.latitude, replayFrame.longitude]);
          replayMarkerRef.current.setIcon(customIcon);
        }
      }
    });
  }, [mode, replayFrame, replayTrack]);

  return (
    <div className="relative w-full h-full min-h-[520px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-obsidian-950">
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: "520px" }} />

      {/* Map Legend Overlay */}
      <div className="absolute top-4 left-4 z-[400] flex items-center gap-2 bg-obsidian-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-xs font-medium text-slate-300 shadow-lg">
        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        {mode === "live" ? (
          <span>
            Windy Live Radar: <strong className="text-white">{liveFlights.length}</strong> commercial aircraft
          </span>
        ) : (
          <span>
            Touchdown Replay: <strong className="text-white">DLH400</strong> Frankfurt Descent
          </span>
        )}
      </div>
    </div>
  );
}
