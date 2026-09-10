/**
 * Module 3: Billboard Batching & Screen-Basis Rotation
 * 
 * Spec: flight-tracking-3d-implementation-guide.md (Module 3)
 * Features:
 * - Single draw-call GPU batching via Cesium.BillboardCollection
 * - Crisp inline SVG data URI with zero external image requests
 * - Screen-Projected Rotation: Projects aircraft forward vector onto camera right/up basis vectors
 * - Depth-test disabling to prevent aircraft from sinking into airport terrain
 */

import * as Cesium from "cesium";
import { AircraftMotionTracker } from "./motion-engine";

// Crisp inline airliner SVG data URI
export const AIRLINER_SVG_DATA_URI =
  "data:image/svg+xml;base64," +
  (typeof btoa === "function"
    ? btoa(`
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 96 96">
  <g transform="translate(48,48)">
    <path d="M0,-42 C 3.8,-40 4.6,-34 4.6,-26 L 4.6,-14 L 32,4 L 34,6 L 34,10 L 31.4,9.2 L 4.6,2.4 L 4.2,20 L 14,28 L 14,32 L 0,28.6 L -14,32 L -14,28 L -4.2,20 L -4.6,2.4 L -31.4,9.2 L -34,10 L -34,6 L -32,4 L -4.6,-14 L -4.6,-26 C -4.6,-34 -3.8,-40 0,-42 Z" fill="white" stroke="rgba(0,0,0,0.4)" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M-15.5,-1.5 l3,7.6 4,-1.4 -1.5,-8.4 Z" fill="white"/>
    <path d="M15.5,-1.5 l-3,7.6 -4,-1.4 1.5,-8.4 Z" fill="white"/>
    <path d="M-1.6,33.5 L 1.6,33.5 L 1.6,40 L -1.6,40 Z" fill="white"/>
  </g>
</svg>`)
    : "");

/**
 * Convert Course into Screen-Projected Rotation on Camera Basis
 */
export function computeScreenProjectedRotation(
  scene: Cesium.Scene,
  position: Cesium.Cartesian3,
  courseDeg: number
): number {
  const camera = scene?.camera;
  if (!camera?.rightWC || !camera?.upWC || !position) return 0;

  const courseRad = Cesium.Math.toRadians(courseDeg || 0);
  // Forward vector 2,000m ahead in local ENU space
  const scratchForward = new Cesium.Cartesian3(
    Math.sin(courseRad) * 2000,
    Math.cos(courseRad) * 2000,
    0
  );
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(position, Cesium.Ellipsoid.WGS84);
  const worldForward = Cesium.Matrix4.multiplyByPointAsVector(enu, scratchForward, new Cesium.Cartesian3());

  // Project vector onto camera right and camera up axes
  const dx = Cesium.Cartesian3.dot(worldForward, camera.rightWC);
  const dy = -Cesium.Cartesian3.dot(worldForward, camera.upWC);

  if (dx * dx + dy * dy < 0.25) return 0; // Filter near-degenerate projections
  return Math.atan2(-dx, -dy);
}

export interface AircraftMeta {
  icao24: string;
  callsign: string;
  lat: number;
  lon: number;
  altitudeM: number;
  velocityMps: number;
  verticalRateMps: number;
  onGround: boolean;
  trueTrackDeg: number;
  lastUpdateMs: number;
}

export interface AircraftLayerEntry {
  bb: Cesium.Billboard;
  tracker: AircraftMotionTracker;
  meta: AircraftMeta;
}

export class FlightsCesiumLayer {
  viewer: Cesium.Viewer;
  billboards: Cesium.BillboardCollection;
  aircraftMap = new Map<string, AircraftLayerEntry>();
  trackedIcao: string | null = null;
  removeTick: (() => void) | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.billboards = new Cesium.BillboardCollection({ scene: viewer.scene });
    viewer.scene.primitives.add(this.billboards);
  }

  init() {
    this.removeTick = this.viewer.scene.preRender.addEventListener(() => this.onFrameTick());
  }

  onFrameTick() {
    const now = Cesium.JulianDate.now();
    const scene = this.viewer.scene;
    const scratchPos = new Cesium.Cartesian3();

    for (const [, entry] of this.aircraftMap) {
      const pos = entry.tracker.evaluatePosition(now, scratchPos);
      if (pos) {
        entry.bb.position = Cesium.Cartesian3.clone(pos);
        entry.bb.rotation = computeScreenProjectedRotation(scene, pos, entry.tracker.displayCourse);
      }
    }
  }

  updateAircraft(
    icao24: string,
    data: {
      lat: number;
      lon: number;
      renderAltitudeM: number;
      velocity: number;
      track: number;
      verticalRateMps?: number;
      onGround?: boolean;
      fixTimeEpochMs: number;
      callsign: string;
    }
  ) {
    const pos = Cesium.Cartesian3.fromDegrees(data.lon, data.lat, data.renderAltitudeM);
    const fixTime = Cesium.JulianDate.fromDate(new Date(data.fixTimeEpochMs));

    let entry = this.aircraftMap.get(icao24);
    if (!entry) {
      const isTracked = icao24 === this.trackedIcao;
      const isLanded = data.onGround || data.renderAltitudeM < 50;

      const bb = this.billboards.add({
        position: pos,
        image: AIRLINER_SVG_DATA_URI,
        width: 26,
        height: 26,
        color: isTracked
          ? Cesium.Color.fromCssColorString("#a7c080") // RouteCO2 evergreen
          : isLanded
          ? Cesium.Color.fromCssColorString("#dbbc7f") // Everforest yellow for landed/ground
          : Cesium.Color.WHITE,
        alignedAxis: Cesium.Cartesian3.ZERO,
        // Disable depth test to prevent aircraft from clipping into terrain
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        id: icao24,
      });

      const tracker = new AircraftMotionTracker();
      tracker.addFix({ fixTime, position: pos, velocity: data.velocity, track: data.track });

      entry = {
        bb,
        tracker,
        meta: {
          icao24: icao24.toLowerCase(),
          callsign: data.callsign || icao24.toUpperCase(),
          lat: data.lat,
          lon: data.lon,
          altitudeM: data.renderAltitudeM,
          velocityMps: data.velocity,
          verticalRateMps: data.verticalRateMps || 0,
          onGround: Boolean(data.onGround),
          trueTrackDeg: data.track,
          lastUpdateMs: Date.now(),
        },
      };
      this.aircraftMap.set(icao24, entry);
    } else {
      entry.meta.icao24 = icao24.toLowerCase();
      entry.meta.callsign = data.callsign || entry.meta.callsign;
      entry.meta.lat = data.lat;
      entry.meta.lon = data.lon;
      entry.meta.altitudeM = data.renderAltitudeM;
      entry.meta.velocityMps = data.velocity;
      entry.meta.verticalRateMps = data.verticalRateMps || entry.meta.verticalRateMps;
      entry.meta.onGround = Boolean(data.onGround);
      entry.meta.trueTrackDeg = data.track;
      entry.meta.lastUpdateMs = Date.now();

      entry.tracker.addFix({ fixTime, position: pos, velocity: data.velocity, track: data.track });
    }
  }

  setTracked(icao24: string | null) {
    if (this.trackedIcao && this.aircraftMap.has(this.trackedIcao)) {
      const prev = this.aircraftMap.get(this.trackedIcao)!;
      prev.bb.color = prev.meta.onGround
        ? Cesium.Color.fromCssColorString("#dbbc7f")
        : Cesium.Color.WHITE;
      prev.bb.width = 26;
      prev.bb.height = 26;
    }

    this.trackedIcao = icao24;
    if (icao24 && this.aircraftMap.has(icao24)) {
      const current = this.aircraftMap.get(icao24)!;
      current.bb.color = Cesium.Color.fromCssColorString("#a7c080"); // RouteCO2 evergreen
      current.bb.width = 34;
      current.bb.height = 34;
    }
  }

  getAircraft(icao24: string): AircraftLayerEntry | undefined {
    return this.aircraftMap.get(icao24);
  }

  getAllAircraft(): AircraftLayerEntry[] {
    return Array.from(this.aircraftMap.values());
  }

  removeAircraft(icao24: string) {
    const entry = this.aircraftMap.get(icao24);
    if (entry) {
      this.billboards.remove(entry.bb);
      this.aircraftMap.delete(icao24);
    }
  }

  pruneExcept(keepIcaos: Set<string>, trackedIcao: string | null) {
    for (const [icao, entry] of this.aircraftMap) {
      if (!keepIcaos.has(icao.toLowerCase()) && icao.toLowerCase() !== trackedIcao?.toLowerCase()) {
        this.billboards.remove(entry.bb);
        this.aircraftMap.delete(icao);
      }
    }
  }

  destroy() {
    if (this.removeTick) {
      this.removeTick();
      this.removeTick = null;
    }
    this.viewer.scene.primitives.remove(this.billboards);
    this.aircraftMap.clear();
  }
}
