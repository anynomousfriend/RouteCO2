import { EventEmitter } from "events";
import {
  type FlightTelemetry,
  calculateWheelsDownEmissions,
  type AircraftCategory,
  type WheelsDownSettlementResult,
} from "./icao-engine.js";

export interface ReplayFrame extends FlightTelemetry {
  timestamp: number;
  latitude?: number;
  longitude?: number;
}

export interface WheelsDownEventPayload {
  frame: ReplayFrame;
  emissions: WheelsDownSettlementResult;
  touchdownIndex: number;
}

export class ReplayStreamer extends EventEmitter {
  private frames: ReplayFrame[];
  private currentIndex: number = 0;
  private takeoffTimestamp: number = 0;
  private category: AircraftCategory;
  private hasLanded: boolean = false;

  constructor(frames: ReplayFrame[], category: AircraftCategory = "NARROW_BODY") {
    super();
    this.frames = frames;
    this.category = category;
    if (frames.length > 0) {
      this.takeoffTimestamp = frames[0].timestamp;
    }
  }

  public stepNext(): ReplayFrame | null {
    if (this.currentIndex >= this.frames.length) return null;
    const current = this.frames[this.currentIndex];
    const prev = this.currentIndex > 0 ? this.frames[this.currentIndex - 1] : null;

    this.emit("tick", current, this.currentIndex, this.frames.length);

    if (prev && !prev.onGround && current.onGround && !this.hasLanded) {
      this.hasLanded = true;
      const airborneSeconds = Math.max(60, current.timestamp - this.takeoffTimestamp);
      const emissions = calculateWheelsDownEmissions(airborneSeconds, this.category);
      this.emit("wheels-down", {
        frame: current,
        emissions,
        touchdownIndex: this.currentIndex,
      } as WheelsDownEventPayload);
    }

    this.currentIndex++;
    return current;
  }

  public reset(): void {
    this.currentIndex = 0;
    this.hasLanded = false;
  }

  public getFrames(): ReplayFrame[] {
    return this.frames;
  }

  public isLanded(): boolean {
    return this.hasLanded;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }
}
