/**
 * Section 4: End-to-End 3D Flight Tracker Orchestrator
 * 
 * Spec: flight-tracking-3d-implementation-guide.md (Section 4)
 * Features:
 * - Geoid Undulation Datum Correction (h = Baro + Geoid(N)) via egm96-universal
 * - 12-second adaptive polling cadence
 * - Click-to-track with smooth ENU-offset camera flyTo
 * - Geodesic trail rendering
 * - Priority ADS-B DB enrichment
 * - Touchdown event detection for automated settlement triggers
 */

import * as Cesium from "cesium";
import { FlightsCesiumLayer, AircraftMeta } from "./flight-layer";
import { FlightTrailRenderer } from "./flight-trail";
import { AdsbdbQueue, AircraftEnrichment } from "./adsbdb-queue";

let egm96Module: any = null;

export async function getGeoidHeight(lat: number, lon: number): Promise<number> {
  if (!egm96Module) {
    try {
      // @ts-ignore
      egm96Module = await import("egm96-universal");
    } catch {
      return 0; // Degrade gracefully to 0 if package is missing
    }
  }
  try {
    const fn = egm96Module.meanSeaLevel || egm96Module.default?.meanSeaLevel;
    if (typeof fn === "function") {
      return fn(lat, lon) || 0;
    }
  } catch {
    // Fall through
  }
  return 0;
}

export interface FlightTrackerCallbacks {
  onAircraftSelected?: (meta: AircraftMeta | null, enrichment?: AircraftEnrichment | null) => void;
  onAircraftTouchdown?: (meta: AircraftMeta) => void;
  onFlightsUpdated?: (airborneCount: number, landedCount: number) => void;
}

export class FlightTrackerApp {
  viewer: Cesium.Viewer;
  layer: FlightsCesiumLayer;
  trail: FlightTrailRenderer;
  enrichment: AdsbdbQueue;
  pollInterval: any = null;
  trackedIcao: string | null = null;
  callbacks: FlightTrackerCallbacks;
  maxAircraftLimit: number = 25;
  isFollowing: boolean = true;
  private isFlyingTo: boolean = false;
  private lastTrackedPos: Cesium.Cartesian3 | null = null;
  private removePreRender: (() => void) | null = null;
  private previousAltitudeMap = new Map<string, number>();

  constructor(viewer: Cesium.Viewer, callbacks: FlightTrackerCallbacks = {}) {
    this.viewer = viewer;
    this.callbacks = callbacks;
    this.layer = new FlightsCesiumLayer(viewer);
    this.trail = new FlightTrailRenderer(viewer, "#a7c080", 3.0);
    this.enrichment = new AdsbdbQueue();
  }

  setMaxAircraftLimit(limit: number) {
    this.maxAircraftLimit = Math.max(5, Math.min(limit, 100));
    this.pruneExcessAircraft();
  }

  private pruneExcessAircraft() {
    const all = this.layer.getAllAircraft();
    if (all.length <= this.maxAircraftLimit) return;

    const cameraCarto = this.viewer.camera.positionCartographic;
    const centerLat = cameraCarto ? Cesium.Math.toDegrees(cameraCarto.latitude) : 40.6413;
    const centerLon = cameraCarto ? Cesium.Math.toDegrees(cameraCarto.longitude) : -73.7781;

    all.sort((a, b) => {
      if (this.trackedIcao) {
        const aMatch =
          a.meta.icao24 === this.trackedIcao.toLowerCase() ||
          a.meta.callsign.toLowerCase() === this.trackedIcao.toLowerCase();
        const bMatch =
          b.meta.icao24 === this.trackedIcao.toLowerCase() ||
          b.meta.callsign.toLowerCase() === this.trackedIcao.toLowerCase();
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      const dLatA = a.meta.lat - centerLat;
      const dLonA = a.meta.lon - centerLon;
      const dLatB = b.meta.lat - centerLat;
      const dLonB = b.meta.lon - centerLon;
      return dLatA * dLatA + dLonA * dLonA - (dLatB * dLatB + dLonB * dLonB);
    });

    const keepSet = new Set(all.slice(0, this.maxAircraftLimit).map((a) => a.meta.icao24));
    this.layer.pruneExcept(keepSet, this.trackedIcao);
    const airborne = all.filter((a) => keepSet.has(a.meta.icao24) && !a.meta.onGround).length;
    const landed = all.filter((a) => keepSet.has(a.meta.icao24) && a.meta.onGround).length;
    this.callbacks.onFlightsUpdated?.(airborne, landed);
  }

  async start() {
    this.layer.init();
    this.setupClickHandler();

    // Hook into preRender for frame-by-frame camera follow and trail synchronization
    this.removePreRender = this.viewer.scene.preRender.addEventListener(() => this.onFrameTick());

    // Initial fetch + 10s polling cadence
    await this.pollFlights();
    this.pollInterval = setInterval(() => this.pollFlights(), 10000);
  }

  setFollowing(follow: boolean) {
    this.isFollowing = follow;
    if (follow && this.trackedIcao) {
      const entry = this.layer.getAircraft(this.trackedIcao);
      if (entry?.bb?.position) {
        this.lastTrackedPos = Cesium.Cartesian3.clone(entry.bb.position);
      }
    }
  }

  private onFrameTick() {
    if (!this.trackedIcao) return;

    const trackedEntry = this.layer.getAircraft(this.trackedIcao);
    if (!trackedEntry || !trackedEntry.bb || !trackedEntry.bb.position) return;

    const currentPlanePos = trackedEntry.bb.position;

    // 1. Anchor live trail directly to the plane's tail position every single frame
    this.trail.updateLiveHead(currentPlanePos);

    // 2. Camera Tracking: Seamlessly lock camera delta to airplane displacement
    if (this.isFollowing && !this.isFlyingTo) {
      if (this.lastTrackedPos) {
        const delta = Cesium.Cartesian3.subtract(currentPlanePos, this.lastTrackedPos, new Cesium.Cartesian3());
        const dMag = Cesium.Cartesian3.magnitude(delta);
        // Apply delta only for smooth continuous motion (< 500m per frame)
        if (dMag > 0.001 && dMag < 500) {
          this.viewer.camera.position = Cesium.Cartesian3.add(
            this.viewer.camera.position,
            delta,
            this.viewer.camera.position
          );
        }
      }
      this.lastTrackedPos = Cesium.Cartesian3.clone(currentPlanePos);
    }
  }

  async pollFlights() {
    try {
      const cameraCarto = this.viewer.camera.positionCartographic;
      const lat = cameraCarto ? Cesium.Math.toDegrees(cameraCarto.latitude).toFixed(4) : "40.6413";
      const lon = cameraCarto ? Cesium.Math.toDegrees(cameraCarto.longitude).toFixed(4) : "-73.7781";

      const res = await fetch(`/api/flights?lat=${lat}&lon=${lon}`);
      if (!res.ok) return;

      const data = await res.json();
      if (!Array.isArray(data.states)) return;

      const nowEpochMs = (Number(data.time) || Math.floor(Date.now() / 1000)) * 1000;
      let airborneCount = 0;
      let landedCount = 0;

      const centerLat = Number(lat);
      const centerLon = Number(lon);

      // Filter valid coordinates
      const validRows = data.states.filter(
        (row: any[]) => row && row[0] && row[5] != null && row[6] != null
      );

      // Sort by proximity to view center, always keeping tracked aircraft top priority
      validRows.sort((a: any[], b: any[]) => {
        if (this.trackedIcao) {
          const aMatch =
            a[0]?.toLowerCase() === this.trackedIcao.toLowerCase() ||
            a[1]?.trim().toLowerCase() === this.trackedIcao.toLowerCase();
          const bMatch =
            b[0]?.toLowerCase() === this.trackedIcao.toLowerCase() ||
            b[1]?.trim().toLowerCase() === this.trackedIcao.toLowerCase();
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
        }
        const dLatA = a[6] - centerLat;
        const dLonA = a[5] - centerLon;
        const dLatB = b[6] - centerLat;
        const dLonB = b[5] - centerLon;
        return dLatA * dLatA + dLonA * dLonA - (dLatB * dLatB + dLonB * dLonB);
      });

      // Target top N airplanes within user limit (default 25)
      const targetRows = validRows.slice(0, this.maxAircraftLimit);
      const keepIcaos = new Set<string>();

      for (const row of targetRows) {
        const [
          icao24,
          rawCallsign,
          ,
          timePos,
          ,
          lonDeg,
          latDeg,
          baroAlt,
          onGround,
          velocity,
          trueTrack,
          verticalRate,
          ,
          geoAlt,
        ] = row;

        if (!icao24 || lonDeg == null || latDeg == null) continue;

        keepIcaos.add(icao24.toLowerCase());

        const isGround = Boolean(onGround) || (Number.isFinite(baroAlt) && baroAlt < 30);
        if (isGround) {
          landedCount++;
        } else {
          airborneCount++;
        }

        // Datum Math: Prefer GNSS ellipsoidal altitude, else Baro + Geoid(N)
        let renderAltitudeM = 10000;
        if (Number.isFinite(geoAlt)) {
          renderAltitudeM = Number(geoAlt);
        } else if (Number.isFinite(baroAlt)) {
          const N = await getGeoidHeight(latDeg, lonDeg);
          renderAltitudeM = Math.max(Number(baroAlt) + N, 0);
        } else if (isGround) {
          renderAltitudeM = await getGeoidHeight(latDeg, lonDeg);
        }

        const fixEpoch = timePos && timePos > 0 ? timePos * 1000 : nowEpochMs;
        const callsign = String(rawCallsign || icao24).trim().toUpperCase();

        // Check for touchdown transition on tracked aircraft (match by icao24 or callsign)
        const isTracked = Boolean(
          this.trackedIcao &&
            (this.trackedIcao.toLowerCase() === icao24.toLowerCase() ||
              this.trackedIcao.toLowerCase() === callsign.toLowerCase())
        );

        if (isTracked) {
          const prevAlt = this.previousAltitudeMap.get(icao24) ?? 10000;
          if (prevAlt > 100 && (renderAltitudeM <= 35 || isGround)) {
            const currentEntry = this.layer.getAircraft(icao24);
            if (currentEntry) {
              this.callbacks.onAircraftTouchdown?.(currentEntry.meta);
            }
          }
          this.previousAltitudeMap.set(icao24, renderAltitudeM);
        }

        this.layer.updateAircraft(icao24, {
          lat: latDeg,
          lon: lonDeg,
          renderAltitudeM,
          velocity: Number.isFinite(velocity) ? Number(velocity) : 0,
          track: Number.isFinite(trueTrack) ? Number(trueTrack) : 0,
          verticalRateMps: Number.isFinite(verticalRate) ? Number(verticalRate) : 0,
          onGround: isGround,
          fixTimeEpochMs: fixEpoch,
          callsign,
        });
      }

      // Prune any aircraft no longer in the visible limited set
      this.layer.pruneExcept(keepIcaos, this.trackedIcao);

      this.callbacks.onFlightsUpdated?.(airborneCount, landedCount);

      // Keep trail updated for actively tracked aircraft
      if (this.trackedIcao) {
        const trackedEntry = this.layer.getAircraft(this.trackedIcao);
        if (trackedEntry) {
          const positions = trackedEntry.tracker.history.map((h) => h.position);
          if (positions.length >= 2) {
            this.trail.setTrailPositions(positions);
          }
        }
      }
    } catch (err) {
      console.warn("[FlightTrackerApp] Poll error:", err);
    }
  }

  setupClickHandler() {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    let isDragging = false;
    let downPos = { x: 0, y: 0 };

    handler.setInputAction((movement: any) => {
      isDragging = false;
      if (movement && movement.position) {
        downPos = { x: movement.position.x, y: movement.position.y };
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((movement: any) => {
      if (!movement || !movement.endPosition) return;
      const dx = movement.endPosition.x - downPos.x;
      const dy = movement.endPosition.y - downPos.y;
      if (dx * dx + dy * dy > 25) {
        isDragging = true;
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction((click: any) => {
      // If user was dragging to orbit or pan the globe, do not treat as a selection click
      if (isDragging) return;

      let pickedIcao: string | null = null;

      // 1. Direct pixel pick on the billboard
      const picked = this.viewer.scene.pick(click.position);
      if (picked && picked.id && typeof picked.id === "string") {
        const found = this.layer.getAircraft(picked.id);
        if (found) pickedIcao = found.meta.icao24;
      }

      // 2. Drill pick within a 15px radius if direct click missed
      if (!pickedIcao) {
        const drill = this.viewer.scene.drillPick(click.position, 15);
        for (const item of drill) {
          if (item && item.id && typeof item.id === "string") {
            const found = this.layer.getAircraft(item.id);
            if (found) {
              pickedIcao = found.meta.icao24;
              break;
            }
          }
        }
      }

      // 3. Screen-space proximity scan (40px click tolerance)
      if (!pickedIcao) {
        let closestDist = 40;
        const clickVec = new Cesium.Cartesian2(click.position.x, click.position.y);
        const scratchScreen = new Cesium.Cartesian2();

        for (const [, entry] of this.layer.aircraftMap) {
          const worldPos = entry.bb?.position;
          if (worldPos) {
            const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(
              this.viewer.scene,
              worldPos,
              scratchScreen
            );
            if (screenPos) {
              const dist = Cesium.Cartesian2.distance(clickVec, screenPos);
              if (dist < closestDist) {
                closestDist = dist;
                pickedIcao = entry.meta.icao24;
              }
            }
          }
        }
      }

      if (pickedIcao) {
        this.trackAircraft(pickedIcao);
      } else {
        // User explicitly clicked empty airspace
        this.untrack();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  trackAircraft(identifier: string) {
    let entry = this.layer.getAircraft(identifier);
    if (!entry) {
      // Lookup by callsign or lowercase hex if direct map key missed
      entry = this.layer
        .getAllAircraft()
        .find(
          (a) =>
            a.meta.callsign.toLowerCase() === identifier.toLowerCase() ||
            a.meta.icao24?.toLowerCase() === identifier.toLowerCase()
        );
    }
    if (!entry) return;

    const realIcao = entry.meta.icao24 || identifier;
    this.trackedIcao = realIcao;
    this.isFollowing = true;
    this.layer.setTracked(realIcao);

    // Populate historical trail and anchor live head immediately
    let historyPositions = entry.tracker.history.map((h) => h.position);
    if (historyPositions.length < 5 && entry.bb?.position && (entry.meta.velocityMps || 0) > 10) {
      const planePos = entry.bb.position;
      const speed = entry.meta.velocityMps || 200;
      const courseDeg = entry.tracker.displayCourse || entry.meta.trueTrackDeg || 0;
      const headingRad = Cesium.Math.toRadians(courseDeg);
      const enu = Cesium.Transforms.eastNorthUpToFixedFrame(planePos, Cesium.Ellipsoid.WGS84);
      const syntheticPast: Cesium.Cartesian3[] = [];
      // Generate 6 smooth backward trail fixes at -60s, -45s, -30s, -20s, -10s, -3s
      for (const dtSec of [-60, -45, -30, -20, -10, -3]) {
        const pastEast = Math.sin(headingRad) * speed * dtSec;
        const pastNorth = Math.cos(headingRad) * speed * dtSec;
        const pastLocal = new Cesium.Cartesian3(pastEast, pastNorth, 0);
        const pastWorld = Cesium.Matrix4.multiplyByPoint(enu, pastLocal, new Cesium.Cartesian3());
        syntheticPast.push(pastWorld);
      }
      historyPositions = [...syntheticPast, ...historyPositions];
    }

    this.trail.setTrailPositions(historyPositions);
    if (entry.bb?.position) {
      this.trail.updateLiveHead(entry.bb.position);
    }

    // Cinematic chase-cam view behind and above the aircraft
    const planePos =
      entry.bb?.position ||
      Cesium.Cartesian3.fromDegrees(entry.meta.lon, entry.meta.lat, entry.meta.altitudeM || 3000);
    const alt = entry.meta.altitudeM || 3000;
    const courseDeg = entry.tracker.displayCourse || entry.meta.trueTrackDeg || 0;
    const headingRad = Cesium.Math.toRadians(courseDeg);
    const pitchRad = Cesium.Math.toRadians(-20.0); // 20° downward chase perspective
    // Range scaled to aircraft speed and altitude for optimal framing
    const followRange = Math.min(Math.max(alt * 0.22 + 1800, 2500), 5500);

    // Position camera behind the aircraft along its flight heading
    const behindHeading = headingRad + Math.PI;
    const hDist = followRange * Math.cos(pitchRad);
    const vDist = -followRange * Math.sin(pitchRad);

    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(planePos, Cesium.Ellipsoid.WGS84);
    const offsetLocal = new Cesium.Cartesian3(
      Math.sin(behindHeading) * hDist,
      Math.cos(behindHeading) * hDist,
      vDist
    );
    const camDest = Cesium.Matrix4.multiplyByPoint(enu, offsetLocal, new Cesium.Cartesian3());

    this.isFlyingTo = true;
    this.lastTrackedPos = null;

    this.viewer.camera.flyTo({
      destination: camDest,
      orientation: {
        heading: headingRad,
        pitch: pitchRad,
        roll: 0.0,
      },
      duration: 1.4,
      complete: () => {
        this.isFlyingTo = false;
        if (entry?.bb?.position) {
          this.lastTrackedPos = Cesium.Cartesian3.clone(entry.bb.position);
        }
      },
      cancel: () => {
        this.isFlyingTo = false;
      },
    });

    // Initial callback to update HUD
    this.callbacks.onAircraftSelected?.(entry.meta, null);

    // Priority enrichment lookup
    this.enrichment.enqueue(
      realIcao,
      entry.meta.callsign,
      (info) => {
        if (this.trackedIcao === realIcao) {
          this.callbacks.onAircraftSelected?.(entry.meta, info);
        }
      },
      true
    );
  }

  untrack() {
    this.trackedIcao = null;
    this.isFollowing = false;
    this.lastTrackedPos = null;
    this.layer.setTracked(null);
    this.trail.clear();
    this.callbacks.onAircraftSelected?.(null, null);
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.removePreRender) {
      this.removePreRender();
      this.removePreRender = null;
    }
    this.layer.destroy();
    this.trail.clear();
  }
}
