"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveFlightSummary, ReplayFrame } from "../lib/replay-scenarios";

export type { ReplayFrame };

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
  const [isMounted, setIsMounted] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const replayPolylineRef = useRef<any>(null);
  const replayMarkerRef = useRef<any>(null);
  const touchdownMarkerRef = useRef<any>(null);
  const sectorRectRef = useRef<any>(null);

  // Set mounted on client hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize Leaflet map (Edge-to-Edge Fullscreen Canvas)
  useEffect(() => {
    if (!isMounted) return;

    let isDisposed = false;
    const container = mapContainerRef.current;
    if (!container) return;

    if (mapInstanceRef.current || (container as any)._leaflet_id) {
      return;
    }

    import("leaflet")
      .then((L) => {
        if (isDisposed || !mapContainerRef.current || (mapContainerRef.current as any)._leaflet_id) {
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

        // Esri World Dark Gray Canvas: Industry standard for dark GIS radar displays
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Tiles &copy; Esri &mdash; OpenSky Network ADS-B",
            maxZoom: 16,
          }
        ).addTo(map);

        // Subtle Reference layer for country boundaries and major city labels
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

        // Force resize recalculations
        setTimeout(() => {
          if (!isDisposed && mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 150);

        setTimeout(() => {
          if (!isDisposed && mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 400);

        // Invalidate size on container resize to prevent tile cutoffs
        if (typeof ResizeObserver !== "undefined" && mapContainerRef.current) {
          const ro = new ResizeObserver(() => {
            if (!isDisposed && mapInstanceRef.current) {
              mapInstanceRef.current.invalidateSize();
            }
          });
          ro.observe(mapContainerRef.current);
          (map as any)._resizeObserver = ro;
        }
      })
      .catch((err) => {
        console.error("Leaflet radar initialization error:", err);
      });

    return () => {
      isDisposed = true;
      if (mapInstanceRef.current) {
        if ((mapInstanceRef.current as any)._resizeObserver) {
          (mapInstanceRef.current as any)._resizeObserver.disconnect();
        }
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
      if (container && (container as any)._leaflet_id) {
        delete (container as any)._leaflet_id;
      }
    };
  }, [isMounted]);

  // Update Live Flight Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || mode !== "live") {
      if (markersLayerRef.current && mode !== "live") {
        markersLayerRef.current.clearLayers();
      }
      return;
    }

    import("leaflet")
      .then((L) => {
        if (!markersLayerRef.current) return;
        markersLayerRef.current.clearLayers();

        liveFlights.forEach((flight) => {
          if (
            flight.latitude == null ||
            flight.longitude == null ||
            isNaN(flight.latitude) ||
            isNaN(flight.longitude)
          ) {
            return;
          }

          const isSelected = selectedFlight?.callsign === flight.callsign;
          const color = isSelected ? "#a7c080" : "#7fbbb3";
          const stroke = isSelected ? "#1e2528" : "#272e33";
          const scale = isSelected ? 1.25 : 1.0;

          const iconHtml = `
            <div style="transform: rotate(${flight.trueTrackDeg || 0}deg) scale(${scale}); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s ease;">
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
            `<div style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; padding: 2px 4px;">
              <strong style="color: #d3c6aa;">${flight.callsign}</strong>
              <span style="color: #9daaa4; margin-left: 4px;">${Math.round((flight.baroAltitudeMeters || 0) * 3.28084)} ft</span>
            </div>`,
            { direction: "top", offset: [0, -10], opacity: 0.95 }
          );

          markersLayerRef.current.addLayer(marker);
        });
      })
      .catch((err) => {
        console.error("Leaflet live flight update error:", err);
      });
  }, [mode, liveFlights, selectedFlight, onSelectFlight]);

  // Smoothly center map on selected flight
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedFlight || mode !== "live") return;
    if (
      selectedFlight.latitude != null &&
      selectedFlight.longitude != null &&
      !isNaN(selectedFlight.latitude) &&
      !isNaN(selectedFlight.longitude)
    ) {
      mapInstanceRef.current.panTo([selectedFlight.latitude, selectedFlight.longitude], {
        animate: true,
        duration: 0.8,
      });
    }
  }, [selectedFlight?.callsign, mode]);

  // Update Replay Flight Descent Track & Airplane Position
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import("leaflet")
      .then((L) => {
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

        const validTrack = (replayTrack || []).filter(
          (f) =>
            f &&
            f.latitude != null &&
            f.longitude != null &&
            !isNaN(f.latitude) &&
            !isNaN(f.longitude)
        );

        // If replay track exists, update or recreate polyline
        if (validTrack.length > 0) {
          if (replayPolylineRef.current) {
            mapInstanceRef.current.removeLayer(replayPolylineRef.current);
            replayPolylineRef.current = null;
          }
          if (touchdownMarkerRef.current) {
            mapInstanceRef.current.removeLayer(touchdownMarkerRef.current);
            touchdownMarkerRef.current = null;
          }
          if (sectorRectRef.current) {
            mapInstanceRef.current.removeLayer(sectorRectRef.current);
            sectorRectRef.current = null;
          }

          const latlngs: [number, number][] = validTrack.map((f) => [f.latitude, f.longitude]);

          const polyline = L.polyline(latlngs, {
            color: "#83c092",
            weight: 3.5,
            opacity: 0.85,
            dashArray: "6, 8",
            lineCap: "round",
          }).addTo(mapInstanceRef.current);

          replayPolylineRef.current = polyline;

          // Destination Runway Approach Bounding Box
          const lastFrame = validTrack[validTrack.length - 1];
          const dLat = 0.035;
          const dLng = 0.055;
          const bounds: [[number, number], [number, number]] = [
            [lastFrame.latitude - dLat, lastFrame.longitude - dLng],
            [lastFrame.latitude + dLat, lastFrame.longitude + dLng],
          ];

          const sectorRect = L.rectangle(bounds, {
            color: "#dbbc7f",
            weight: 1.5,
            dashArray: "5, 5",
            fillColor: "#dbbc7f",
            fillOpacity: 0.12,
          }).addTo(mapInstanceRef.current);

          sectorRectRef.current = sectorRect;

          // Destination Airport Touchdown Ring
          const tdIcon = L.divIcon({
            html: `
              <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
                <span style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: rgba(219, 188, 127, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
                <span style="position: relative; width: 14px; height: 14px; border-radius: 50%; background: #dbbc7f; border: 2.5px solid #1e2528; box-shadow: 0 0 10px #dbbc7f;"></span>
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
              `<div style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; padding: 2px 4px;">
                <strong style="color: #dbbc7f;">${label}</strong>
              </div>`,
              { permanent: true, direction: "bottom", offset: [0, 10] }
            )
            .addTo(mapInstanceRef.current);

          try {
            mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [60, 60] });
          } catch {}
        }

        // Update Moving Replay Airplane Marker
        if (
          replayFrame &&
          replayFrame.latitude != null &&
          replayFrame.longitude != null &&
          !isNaN(replayFrame.latitude) &&
          !isNaN(replayFrame.longitude)
        ) {
          const isTouchdown = replayFrame.onGround;
          const color = isTouchdown ? "#a7c080" : "#d3c6aa"; // Green on touchdown
          const fill = isTouchdown ? "#a7c080" : "#83c092";

          const iconHtml = `
            <div style="transform: rotate(${replayFrame.trueTrackDeg || 0}deg); width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; transition: transform 0.25s linear;">
              <svg width="38" height="38" viewBox="0 0 122.88 122.88" style="filter: drop-shadow(0 4px 12px rgba(131, 192, 146, 0.65));">
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
      })
      .catch((err) => {
        console.error("Leaflet replay update error:", err);
      });
  }, [mode, replayFrame, replayTrack, destinationLabel]);

  if (!isMounted) {
    return (
      <div className="w-full h-full min-h-[220px] bg-[#1e2528] flex items-center justify-center text-xs font-mono text-[#9daaa4]">
        <span className="w-2 h-2 bg-[#a7c080] blink-step mr-2" />
        Acquiring Spatial Radar Telemetry...
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[200px] bg-[#1e2528] isolate z-0">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
