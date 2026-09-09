import { describe, it, expect } from "vitest";
import {
  ReplayStreamer,
  generateDescentTrajectory,
  type ReplayFrame,
  type WheelsDownEventPayload,
} from "../src/replay-streamer.js";

describe("Dynamic Aeronautical Flight Trajectory Generator & Streamer (Zero-Mock Engine)", () => {
  it("generates realistic flight trajectory dataset with valid structure and schema", () => {
    const flightData = generateDescentTrajectory("FRA", "FRA", "NARROW_BODY");

    expect(Array.isArray(flightData)).toBe(true);
    expect(flightData.length).toBeGreaterThanOrEqual(15);

    for (const frame of flightData) {
      expect(frame.callsign).toBe("DLH400");
      expect(typeof frame.baroAltitudeMeters).toBe("number");
      expect(typeof frame.velocityMps).toBe("number");
      expect(typeof frame.verticalRateMps).toBe("number");
      expect(typeof frame.onGround).toBe("boolean");
      expect(typeof frame.timestamp).toBe("number");
      expect(typeof frame.latitude).toBe("number");
      expect(typeof frame.longitude).toBe("number");
      expect(typeof frame.trueTrackDeg).toBe("number");
    }
  });

  it("verifies flight descent profile, touchdown frame, and rollout telemetry", () => {
    const frames = generateDescentTrajectory("FRA", "FRA", "NARROW_BODY");

    // Airborne descent sequence
    const airborneFrames = frames.filter((f) => !f.onGround);
    expect(airborneFrames.length).toBeGreaterThanOrEqual(10);
    expect(airborneFrames[0].baroAltitudeMeters).toBe(8000);
    expect(airborneFrames[airborneFrames.length - 1].baroAltitudeMeters).toBeLessThanOrEqual(15);

    // Ensure altitude generally decreases across airborne frames
    expect(airborneFrames[airborneFrames.length - 1].baroAltitudeMeters).toBeLessThan(
      airborneFrames[0].baroAltitudeMeters
    );

    // Touchdown frame
    const touchdownIndex = frames.findIndex(
      (f, idx) => idx > 0 && !frames[idx - 1].onGround && f.onGround
    );
    expect(touchdownIndex).toBeGreaterThan(0);

    const touchdownFrame = frames[touchdownIndex];
    expect(touchdownFrame.baroAltitudeMeters).toBe(8);
    expect(touchdownFrame.velocityMps).toBe(68);
    expect(touchdownFrame.verticalRateMps).toBe(-0.5);
    expect(touchdownFrame.onGround).toBe(true);

    // Rollout sequence
    const rolloutFrames = frames.slice(touchdownIndex);
    expect(rolloutFrames.length).toBeGreaterThanOrEqual(4);
    for (const frame of rolloutFrames) {
      expect(frame.onGround).toBe(true);
    }
    const finalFrame = rolloutFrames[rolloutFrames.length - 1];
    expect(finalFrame.velocityMps).toBe(15);
  });

  it("streams telemetry step-by-step and emits tick events with accurate progress", () => {
    const frames = generateDescentTrajectory();
    const streamer = new ReplayStreamer(frames);

    expect(streamer.getCurrentIndex()).toBe(0);
    expect(streamer.isLanded()).toBe(false);
    expect(streamer.getFrames().length).toBe(frames.length);

    let recordedTick: { frame: ReplayFrame; index: number; total: number } | null = null;
    streamer.on("tick", (frame: ReplayFrame, index: number, total: number) => {
      recordedTick = { frame, index, total };
    });

    const firstFrame = streamer.stepNext();
    expect(firstFrame).toEqual(frames[0]);
    expect(recordedTick).toEqual({ frame: frames[0], index: 0, total: frames.length });
    expect(streamer.getCurrentIndex()).toBe(1);
  });

  it("fires wheels-down event at exact touchdown frame and calculates ICAO emissions", () => {
    const frames = generateDescentTrajectory("FRA", "FRA", "NARROW_BODY");
    const streamer = new ReplayStreamer(frames, "NARROW_BODY");

    const wheelsDownEvents: WheelsDownEventPayload[] = [];
    streamer.on("wheels-down", (payload: WheelsDownEventPayload) => {
      wheelsDownEvents.push(payload);
    });

    // Step through the entire flight
    let stepResult = streamer.stepNext();
    while (stepResult !== null) {
      stepResult = streamer.stepNext();
    }

    // Must have fired exactly once
    expect(wheelsDownEvents.length).toBe(1);
    const event = wheelsDownEvents[0];

    // Frame at touchdown
    expect(event.frame.onGround).toBe(true);
    expect(event.frame.baroAltitudeMeters).toBe(8);
    expect(event.frame.velocityMps).toBe(68);
    expect(event.touchdownIndex).toBe(
      frames.findIndex((f, idx) => idx > 0 && !frames[idx - 1].onGround && f.onGround)
    );

    // Valid ICAO emissions result
    const emissions = event.emissions;
    expect(emissions.aircraftCategory).toBe("NARROW_BODY");
    expect(emissions.airborneSeconds).toBeGreaterThan(0);
    expect(emissions.fuelBurnKg).toBeGreaterThan(0);
    expect(emissions.co2Kg).toBeGreaterThan(0);
    expect(emissions.costUSDC).toBeGreaterThan(0);
    expect(emissions.usdcAmountMicro).toBeGreaterThan(0n);
    expect(streamer.isLanded()).toBe(true);
  });

  it("does not fire duplicate wheels-down events during subsequent rollout frames", () => {
    const frames = generateDescentTrajectory();
    const streamer = new ReplayStreamer(frames);

    let wheelsDownCount = 0;
    streamer.on("wheels-down", () => {
      wheelsDownCount++;
    });

    const touchdownIndex = frames.findIndex(
      (f, idx) => idx > 0 && !frames[idx - 1].onGround && f.onGround
    );

    // Step until touchdown
    for (let i = 0; i <= touchdownIndex; i++) {
      streamer.stepNext();
    }
    expect(wheelsDownCount).toBe(1);
    expect(streamer.isLanded()).toBe(true);

    // Step remaining rollout frames
    for (let i = touchdownIndex + 1; i < frames.length; i++) {
      streamer.stepNext();
    }
    expect(wheelsDownCount).toBe(1);

    // Beyond last frame
    const overStep = streamer.stepNext();
    expect(overStep).toBeNull();
    expect(wheelsDownCount).toBe(1);
  });

  it("resets streamer state and allows re-streaming replay flight", () => {
    const frames = generateDescentTrajectory();
    const streamer = new ReplayStreamer(frames);

    // Fast-forward to end
    while (streamer.stepNext() !== null) {}
    expect(streamer.isLanded()).toBe(true);
    expect(streamer.getCurrentIndex()).toBe(frames.length);

    // Reset
    streamer.reset();
    expect(streamer.getCurrentIndex()).toBe(0);
    expect(streamer.isLanded()).toBe(false);

    let wheelsDownTriggered = false;
    streamer.on("wheels-down", () => {
      wheelsDownTriggered = true;
    });

    // Step to touchdown again
    const touchdownIndex = frames.findIndex(
      (f, idx) => idx > 0 && !frames[idx - 1].onGround && f.onGround
    );
    for (let i = 0; i <= touchdownIndex; i++) {
      streamer.stepNext();
    }

    expect(wheelsDownTriggered).toBe(true);
    expect(streamer.isLanded()).toBe(true);
  });

  it("supports different aircraft categories and scales wheels-down emissions accordingly", () => {
    const narrowFrames = generateDescentTrajectory("FRA", "FRA", "NARROW_BODY");
    const wideFrames = generateDescentTrajectory("FRA", "FRA", "WIDE_BODY");

    const narrowStreamer = new ReplayStreamer(narrowFrames, "NARROW_BODY");
    const wideStreamer = new ReplayStreamer(wideFrames, "WIDE_BODY");

    let narrowPayload: WheelsDownEventPayload | null = null;
    narrowStreamer.on("wheels-down", (p) => {
      narrowPayload = p;
    });

    let widePayload: WheelsDownEventPayload | null = null;
    wideStreamer.on("wheels-down", (p) => {
      widePayload = p;
    });

    while (narrowStreamer.stepNext() !== null) {}
    while (wideStreamer.stepNext() !== null) {}

    expect(narrowPayload).not.toBeNull();
    expect(widePayload).not.toBeNull();
    expect(widePayload!.emissions.hourlyBurnKg).toBeGreaterThan(
      narrowPayload!.emissions.hourlyBurnKg
    );
    expect(widePayload!.emissions.fuelBurnKg).toBeGreaterThan(
      narrowPayload!.emissions.fuelBurnKg
    );
    expect(widePayload!.emissions.usdcAmountMicro).toBeGreaterThan(
      narrowPayload!.emissions.usdcAmountMicro
    );
  });

  it("generates trajectories for different destinations (e.g. JFK)", () => {
    const jfkFrames = generateDescentTrajectory("FRA", "JFK", "WIDE_BODY", {
      callsign: "BAW117",
    });
    expect(jfkFrames.length).toBeGreaterThanOrEqual(15);
    expect(jfkFrames[0].callsign).toBe("BAW117");
    // JFK latitude is ~40.64
    expect(jfkFrames[jfkFrames.length - 1].latitude).toBeCloseTo(40.64, 1);
  });
});
