/**
 * Module 4: 3D Flight Trajectory & Live Breadcrumb Trail
 * 
 * Spec: flight-tracking-3d-implementation-guide.md (Module 4)
 * Features:
 * - Cesium.ArcType.NONE renders true 3D flight trajectory at altitude without geodesic surface warping
 * - Dynamic live-head anchoring connects trail directly to the moving aircraft on every frame
 * - Vertical ground projection line for immediate altitude perception
 * - depthFailMaterial renders occluded segments dimmed rather than clipping through terrain
 */

import * as Cesium from "cesium";

export class FlightTrailRenderer {
  viewer: Cesium.Viewer;
  baseColor: Cesium.Color;
  width: number;
  positions: Cesium.Cartesian3[] = [];
  trailEntity: Cesium.Entity | null = null;
  dropLineEntity: Cesium.Entity | null = null;
  private currentLivePos: Cesium.Cartesian3 | null = null;
  private currentGroundPos: Cesium.Cartesian3 | null = null;

  constructor(viewer: Cesium.Viewer, colorHex = "#a7c080", width = 3.0) {
    this.viewer = viewer;
    this.baseColor = Cesium.Color.fromCssColorString(colorHex);
    this.width = width;
  }

  /**
   * Set or append historical positions
   */
  setTrailPositions(cartesianArray: Cesium.Cartesian3[]) {
    if (!cartesianArray || cartesianArray.length === 0) return;

    // Filter out invalid/zero positions and deduplicate consecutive identical fixes
    const valid: Cesium.Cartesian3[] = [];
    for (const p of cartesianArray) {
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
        if (valid.length === 0 || Cesium.Cartesian3.distance(valid[valid.length - 1], p) > 10) {
          valid.push(p.clone ? p.clone() : Cesium.Cartesian3.clone(p));
        }
      }
    }
    if (valid.length === 0) return;

    this.positions = valid.slice(-150); // Keep last 150 fixes for clean memory
    this.ensureEntitiesCreated();
    this.requestFrame();
  }

  /**
   * Update live head position on each animation frame
   */
  updateLiveHead(livePosition: Cesium.Cartesian3) {
    if (!livePosition || !Number.isFinite(livePosition.x)) return;

    this.currentLivePos = livePosition;

    // Compute ground drop position (same lat/lon at 0m altitude)
    const carto = Cesium.Cartographic.fromCartesian(livePosition);
    if (carto) {
      this.currentGroundPos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
    }

    if (this.positions.length === 0) {
      this.positions.push(livePosition.clone());
    } else {
      const last = this.positions[this.positions.length - 1];
      const dist = Cesium.Cartesian3.distance(last, livePosition);
      // Append new sample if moved > 80m, else update head in place
      if (dist > 80) {
        this.positions.push(livePosition.clone());
        if (this.positions.length > 150) this.positions.shift();
      } else {
        this.positions[this.positions.length - 1] = livePosition;
      }
    }

    this.ensureEntitiesCreated();
    this.requestFrame();
  }

  private requestFrame() {
    try {
      this.viewer.scene.requestRender();
    } catch {
      // Viewer may be tearing down; ignore.
    }
  }

  private ensureEntitiesCreated() {
    // 1. 3D Flight Polyline
    if (!this.trailEntity && this.positions.length >= 2) {
      this.trailEntity = this.viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => this.positions, false),
          width: this.width,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: this.baseColor,
          }),
          depthFailMaterial: this.baseColor.withAlpha(0.25),
          // ArcType.NONE is critical: Prevents 3D positions at altitude from being projected
          // down to the ellipsoid surface which caused the line to skew and twist across the globe.
          arcType: Cesium.ArcType.NONE,
        },
      });
    }

    // 2. Vertical Altitude Drop Line (from aircraft down to ground)
    if (!this.dropLineEntity) {
      this.dropLineEntity = this.viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if (this.currentLivePos && this.currentGroundPos) {
              return [this.currentLivePos, this.currentGroundPos];
            }
            return [];
          }, false),
          width: 1.2,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString("#a7c080").withAlpha(0.5),
            dashLength: 12.0,
          }),
          arcType: Cesium.ArcType.NONE,
        },
      });
    }
  }

  clear() {
    this.positions = [];
    this.currentLivePos = null;
    this.currentGroundPos = null;
    if (this.trailEntity) {
      this.viewer.entities.remove(this.trailEntity);
      this.trailEntity = null;
    }
    if (this.dropLineEntity) {
      this.viewer.entities.remove(this.dropLineEntity);
      this.dropLineEntity = null;
    }
    this.requestFrame();
  }
}

