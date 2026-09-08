"use client";

import { useEffect, useRef } from "react";
import type { LiveFlightSummary } from "../app/api/live-flights/route";

export interface ReplayFrame {
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
  destinationLabel?: string;
  onSelectFlight: (flight: LiveFlightSummary | ReplayFrame) => void;
}

export default function WindyFlightMap({
  mode,
  liveFlights,
  selectedFlight,
  replayFrame,
  replayTrack,
  destinationLabel,
  onSelectFlight,
}: WindyFlightMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const replayPolylineRef = useRef<any>(null);
  const replayMarkerRef = useRef<any>(null);
  const touchdownMarkerRef = useRef<any>(null);

  // Initialize Leaflet map (Edge-to-Edge Fullscreen Canvas)
  useEffect(() => {
    let isMounted = true;
    const container = mapContainerRef.current;
    if (!container) return;

    if (mapInstanceRef.current || (container as any)._leaflet_id) {
      return;
    }

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current || (mapContainerRef.current as any)._leaflet_id) {
        return;
      }

      const map = L.map(mapContainerRef.current, {
        center: [50.1109, 8.6821], // Frankfurt / Central Europe
        zoom: 7,
        minZoom: 3,
        maxZoom: 16,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Esri World Dark Gray Canvas: Industry standard for dark GIS radar displays (Zero API key, zero watermarks)
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri &mdash; OpenSky Network ADS-B",
          maxZoom: 16,
        }
      ).addTo(map);

      // Subtle Reference layer for country boundaries and major city labels (Zero API key, zero watermarks)
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 16,
          opacity: 0.75,
        }
      ).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Invalidate size on container resize to prevent tile cutoffs
      if (typeof ResizeObserver !== "undefined" && mapContainerRef.current) {
        const ro = new ResizeObserver(() => {
          map.invalidateSize();
        });
        ro.observe(mapContainerRef.current);
        (map as any)._resizeObserver = ro;
      }
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        if ((mapInstanceRef.current as any)._resizeObserver) {
          (mapInstanceRef.current as any)._resizeObserver.disconnect();
        }
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
    if (!mapInstanceRef.current || !markersLayerRef.current || mode !== "live") {
      if (markersLayerRef.current && mode !== "live") {
        markersLayerRef.current.clearLayers();
      }
      return;
    }

    import("leaflet").then((L) => {
      markersLayerRef.current.clearLayers();

      liveFlights.forEach((flight) => {
        const isSelected = selectedFlight?.callsign === flight.callsign;
        const color = isSelected ? "#06B6D4" : "#4C63ED";
        const stroke = isSelected ? "#FFFFFF" : "#1E293B";
        const scale = isSelected ? 1.25 : 1.0;

        const iconHtml = `
          <div style="transform: rotate(${flight.trueTrackDeg}deg) scale(${scale}); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s ease;">
            <svg width="26" height="26" viewBox="0 0 122.88 122.88" style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.65));">
              <g fill="${color}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round" transform="translate(61.44, 61.44) rotate(-45) scale(0.68) translate(-61.44, -61.44)">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M16.63,105.75c0.01-4.03,2.3-7.97,6.03-12.38L1.09,79.73c-1.36-0.59-1.33-1.42-0.54-2.4l4.57-3.9c0.83-0.51,1.71-0.73,2.66-0.47l26.62,4.5l22.18-24.02L4.8,18.41c-1.31-0.77-1.42-1.64-0.07-2.65l7.47-5.96l67.5,18.97L99.64,7.45c6.69-5.79,13.19-8.38,18.18-7.15c2.75,0.68,3.72,1.5,4.57,4.08c1.65,5.06-0.91,11.86-6.96,18.86L94.11,43.18l18.97,67.5l-5.96,7.47c-1.01,1.34-1.88,1.23-2.65-0.07L69.43,66.31L45.41,88.48l4.5,26.62c0.26,0.94,0.05,1.82-0.47,2.66l-3.9,4.57c-0.97,0.79-1.81,0.82-2.4-0.54l-13.64-21.57c-4.43,3.74-8.37,6.03-12.42,6.03C16.71,106.24,16.63,106.11,16.63,105.75L16.63,105.75z"/>
              </g>
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "plane-marker-clean",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([flight.latitude, flight.longitude], { icon: customIcon });

        marker.on("click", () => {
          onSelectFlight(flight);
        });

        marker.bindTooltip(
          `<div style="font-family: monospace; font-size: 11px; padding: 2px 4px;">
            <strong style="color: #F8FAFC;">${flight.callsign}</strong>
            <span style="color: #94A3B8; margin-left: 4px;">${Math.round(flight.baroAltitudeMeters * 3.28084)} ft</span>
          </div>`,
          { direction: "top", offset: [0, -10], opacity: 0.95 }
        );

        markersLayerRef.current.addLayer(marker);
      });
    });
  }, [mode, liveFlights, selectedFlight, onSelectFlight]);

  // Smoothly center map on selected flight
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedFlight || mode !== "live") return;
    mapInstanceRef.current.panTo([selectedFlight.latitude, selectedFlight.longitude], {
      animate: true,
      duration: 0.8,
    });
  }, [selectedFlight?.callsign, mode]);

  // Update Replay Flight Descent Track & Airplane Position
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      // Clear Replay elements if in live mode
      if (mode !== "replay") {
        if (replayPolylineRef.current) {
          mapInstanceRef.current.removeLayer(replayPolylineRef.current);
          replayPolylineRef.current = null;
        }
        if (replayMarkerRef.current) {
          mapInstanceRef.current.removeLayer(replayMarkerRef.current);
          replayMarkerRef.current = null;
        }
        if (touchdownMarkerRef.current) {
          mapInstanceRef.current.removeLayer(touchdownMarkerRef.current);
          touchdownMarkerRef.current = null;
        }
        return;
      }

      // If replay track exists, update or recreate polyline
      if (replayTrack && replayTrack.length > 0) {
        if (replayPolylineRef.current) {
          mapInstanceRef.current.removeLayer(replayPolylineRef.current);
          replayPolylineRef.current = null;
        }
        if (touchdownMarkerRef.current) {
          mapInstanceRef.current.removeLayer(touchdownMarkerRef.current);
          touchdownMarkerRef.current = null;
        }

        const latlngs: [number, number][] = replayTrack.map((f) => [f.latitude, f.longitude]);

        const polyline = L.polyline(latlngs, {
          color: "#4C63ED",
          weight: 3.5,
          opacity: 0.85,
          dashArray: "6, 8",
          lineCap: "round",
        }).addTo(mapInstanceRef.current);

        replayPolylineRef.current = polyline;

        // Destination Airport Touchdown Ring
        const lastFrame = replayTrack[replayTrack.length - 1];
        const tdIcon = L.divIcon({
          html: `
            <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
              <span style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: rgba(76, 99, 237, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
              <span style="position: relative; width: 14px; height: 14px; border-radius: 50%; background: #4C63ED; border: 2.5px solid #FFFFFF; box-shadow: 0 0 10px #4C63ED;"></span>
            </div>
          `,
          className: "touchdown-marker",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const label = destinationLabel || "Touchdown Target";
        touchdownMarkerRef.current = L.marker([lastFrame.latitude, lastFrame.longitude], {
          icon: tdIcon,
          zIndexOffset: 500,
        })
          .bindTooltip(
            `<div style="font-family: monospace; font-size: 11px; padding: 2px 4px;">
              <strong style="color: #4C63ED;">${label}</strong>
            </div>`,
            { permanent: true, direction: "bottom", offset: [0, 10] }
          )
          .addTo(mapInstanceRef.current);

        mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [60, 60] });
      }

      // Update Moving Replay Airplane Marker
      if (replayFrame) {
        const isTouchdown = replayFrame.onGround;
        const color = isTouchdown ? "#10B981" : "#FFFFFF"; // Green on touchdown
        const fill = isTouchdown ? "#10B981" : "#4C63ED";

        const iconHtml = `
          <div style="transform: rotate(${replayFrame.trueTrackDeg}deg); width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; transition: transform 0.25s linear;">
            <svg width="38" height="38" viewBox="0 0 122.88 122.88" style="filter: drop-shadow(0 4px 12px rgba(76, 99, 237, 0.75));">
              <g fill="${fill}" stroke="${color}" stroke-width="3" stroke-linejoin="round" transform="translate(61.44, 61.44) rotate(-45) scale(0.68) translate(-61.44, -61.44)">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M16.63,105.75c0.01-4.03,2.3-7.97,6.03-12.38L1.09,79.73c-1.36-0.59-1.33-1.42-0.54-2.4l4.57-3.9c0.83-0.51,1.71-0.73,2.66-0.47l26.62,4.5l22.18-24.02L4.8,18.41c-1.31-0.77-1.42-1.64-0.07-2.65l7.47-5.96l67.5,18.97L99.64,7.45c6.69-5.79,13.19-8.38,18.18-7.15c2.75,0.68,3.72,1.5,4.57,4.08c1.65,5.06-0.91,11.86-6.96,18.86L94.11,43.18l18.97,67.5l-5.96,7.47c-1.01,1.34-1.88,1.23-2.65-0.07L69.43,66.31L45.41,88.48l4.5,26.62c0.26,0.94,0.05,1.82-0.47,2.66l-3.9,4.57c-0.97,0.79-1.81,0.82-2.4-0.54l-13.64-21.57c-4.43,3.74-8.37,6.03-12.42,6.03C16.71,106.24,16.63,106.11,16.63,105.75L16.63,105.75z"/>
              </g>
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "replay-plane-clean",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
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
  }, [mode, replayFrame, replayTrack, destinationLabel]);

  return (
    <div className="relative w-full h-full min-h-[200px] bg-[#0B0F19] isolate z-0">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
