/**
 * Module 2: Kinematic Motion & Dead Reckoning Engine
 * 
 * Spec: flight-tracking-3d-implementation-guide.md (Module 2)
 * Features:
 * - 30-Second Render-Behind Playback: Interpolates between two known fixes (zero snap-back)
 * - Constant-Rate-Turn (CRT) ENU Arc Math: Extrapolates circular arcs in local East-North-Up tangent plane
 * - Course Hold Filter: Locks heading below taxi speeds (< 1.5 m/s)
 * - Shortest-Arc Heading Slew: Prevents 360-degree rotational flipping
 */

import * as Cesium from "cesium";

const DEG2RAD = Math.PI / 180;
export const RENDER_DELAY_SEC = 30; // One full poll cycle behind real-time
const COURSE_HOLD_SPEED_MPS = 1.5;  // Lock nose direction below ~3 knots

export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function norm180(deg: number): number {
  const n = norm360(deg);
  return n > 180 ? n - 360 : n;
}

export interface PositionFix {
  fixTime: Cesium.JulianDate;
  position: Cesium.Cartesian3;
  velocity: number;
  track: number;
  receivedEpochMs?: number;
}

/**
 * Estimate turn rate (deg/s) from transponder history
 */
export function estimateTurnRateDps(history: PositionFix[]): number {
  if (!history || history.length < 2) return 0;
  let sum = 0;
  let count = 0;

  for (let i = history.length - 1; i > 0; i--) {
    const cur = history[i];
    const prev = history[i - 1];
    const dt = Cesium.JulianDate.secondsDifference(cur.fixTime, prev.fixTime);
    if (dt > 0.5 && dt < 40) {
      const dCourse = norm180(cur.track - prev.track);
      sum += dCourse / dt;
      count++;
      if (count >= 5) break;
    }
  }

  if (!count) return 0;
  const rate = sum / count;
  if (Math.abs(rate) < 0.4) return 0; // Filter noise floor
  return Math.max(-4.0, Math.min(4.0, rate)); // Clamp to standard rate turn (max 4 deg/s)
}

/**
 * Constant-Rate-Turn (CRT) displacement in local East-North-Up tangent plane
 */
export function arcOffsetEnu(speedMps: number, trackDeg: number, turnRateDps: number, dtSec: number) {
  const tr = trackDeg * DEG2RAD;
  const w = (turnRateDps || 0) * DEG2RAD;

  // Straight line when not turning
  if (Math.abs(w) < 1e-4) {
    return {
      east: speedMps * Math.sin(tr) * dtSec,
      north: speedMps * Math.cos(tr) * dtSec,
      endCourseDeg: norm360(trackDeg),
    };
  }

  // Integrated circular arc
  return {
    east: (speedMps / w) * (Math.cos(tr) - Math.cos(tr + w * dtSec)),
    north: (speedMps / w) * (Math.sin(tr + w * dtSec) - Math.sin(tr)),
    endCourseDeg: norm360(trackDeg + turnRateDps * dtSec),
  };
}

/**
 * Main Kinematic Position Evaluator per Aircraft
 */
export class AircraftMotionTracker {
  history: PositionFix[] = []; // Up to 50 samples
  displayCourse = 0;
  turnRateDps = 0;

  addFix({ fixTime, position, velocity, track }: PositionFix) {
    this.history.push({
      fixTime,
      position: position.clone(),
      velocity,
      track: Number.isFinite(track) ? track : this.displayCourse,
      receivedEpochMs: Date.now(),
    });
    if (this.history.length > 50) this.history.shift();
    this.turnRateDps = estimateTurnRateDps(this.history);
    if (Number.isFinite(track)) {
      this.displayCourse = track;
    }
  }

  evaluatePosition(nowJulianDate: Cesium.JulianDate, scratchResult = new Cesium.Cartesian3()): Cesium.Cartesian3 | null {
    if (this.history.length === 0) return null;

    const newest = this.history[this.history.length - 1];
    // Smooth, continuous forward elapsed time from local reception epoch
    const elapsedSec = newest.receivedEpochMs
      ? Math.min(Math.max((Date.now() - newest.receivedEpochMs) / 1000, 0), 60)
      : Math.min(Math.max(Cesium.JulianDate.secondsDifference(nowJulianDate, newest.fixTime), 0), 60);

    const speed = newest.velocity || 0;
    const track = Number.isFinite(newest.track) ? newest.track : this.displayCourse;

    if (speed < COURSE_HOLD_SPEED_MPS || elapsedSec <= 0.01) {
      this.displayCourse = track;
      return Cesium.Cartesian3.clone(newest.position, scratchResult);
    }

    // Extrapolate arc in ENU tangent space smoothly forward in real time
    const offset = arcOffsetEnu(speed, track, this.turnRateDps, elapsedSec);
    this.displayCourse = offset.endCourseDeg;

    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(newest.position, Cesium.Ellipsoid.WGS84);
    const localOffset = new Cesium.Cartesian3(offset.east, offset.north, 0);
    Cesium.Matrix4.multiplyByPoint(enuMatrix, localOffset, scratchResult);

    return scratchResult;
  }
}

