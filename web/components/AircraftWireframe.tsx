"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Crosshair, RotateCcw, Sparkles } from "lucide-react";

interface AircraftWireframeProps {
  callsign: string;
  airframe: string;
  icao24: string;
  hourlyBurnKg: number;
  runway: string;
  altitudeFt: number;
  speedKts: number;
  className?: string;
}

type Point3D = [number, number, number];
type Edge = [number, number, "fuselage" | "wing" | "engine" | "stabilizer" | "detail"];

interface AirframeSpecs {
  category: string;
  wingspanM: number;
  lengthM: number;
  engineCount: number;
  engineModel: string;
  baseFuelBurnKg: number;
}

export function AircraftWireframe({
  callsign,
  airframe,
  icao24,
  hourlyBurnKg,
  runway,
  altitudeFt,
  speedKts,
  className = "",
}: AircraftWireframeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Airframe Specifications Database
  const specs: AirframeSpecs = useMemo(() => {
    const name = (airframe || "").toUpperCase();
    if (name.includes("A380") || name.includes("B747")) {
      return {
        category: "SUPER-HEAVY QUAD",
        wingspanM: name.includes("A380") ? 79.8 : 68.4,
        lengthM: name.includes("A380") ? 72.7 : 76.3,
        engineCount: 4,
        engineModel: name.includes("A380") ? "4x Trent 900" : "4x GEnx-2B",
        baseFuelBurnKg: 10500,
      };
    }
    if (
      name.includes("B777") ||
      name.includes("B77W") ||
      name.includes("A350") ||
      name.includes("B787") ||
      name.includes("A330")
    ) {
      return {
        category: "WIDE-BODY TWIN",
        wingspanM: name.includes("A350") ? 64.8 : 60.1,
        lengthM: name.includes("B77W") ? 73.9 : 66.8,
        engineCount: 2,
        engineModel: name.includes("A350") ? "2x Trent XWB" : "2x GE9X-105B",
        baseFuelBurnKg: 6500,
      };
    }
    if (
      name.includes("E190") ||
      name.includes("E195") ||
      name.includes("CRJ") ||
      name.includes("AT7") ||
      name.includes("DH8")
    ) {
      return {
        category: "REGIONAL TWIN",
        wingspanM: 28.7,
        lengthM: 36.2,
        engineCount: 2,
        engineModel: "2x GE CF34-10E",
        baseFuelBurnKg: 1600,
      };
    }
    // Default Narrowbody (A320 / B737)
    return {
      category: "NARROW-BODY TWIN",
      wingspanM: 35.8,
      lengthM: 37.6,
      engineCount: 2,
      engineModel: "2x CFM LEAP-1A",
      baseFuelBurnKg: 2400,
    };
  }, [airframe]);

  // Rotational angles (Euler degrees: pitch, yaw, roll)
  const [pitch, setPitch] = useState(-20);
  const [yaw, setYaw] = useState(35);
  const [roll, setRoll] = useState(0);

  // Target angles for smooth interpolation
  const targetAngles = useRef({ pitch: -20, yaw: 35, roll: 0 });
  const currentAngles = useRef({ pitch: -20, yaw: 35, roll: 0 });

  // Interaction State
  const [isAutoOrbit, setIsAutoOrbit] = useState(true);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const [activeView, setActiveView] = useState<"iso" | "top" | "front" | "side">("iso");

  // Burn thrust scale factor (0.5 to 2.0)
  const thrustScale = useMemo(() => {
    if (!hourlyBurnKg || !specs.baseFuelBurnKg) return 1.0;
    const ratio = hourlyBurnKg / specs.baseFuelBurnKg;
    return Math.max(0.6, Math.min(2.2, ratio));
  }, [hourlyBurnKg, specs.baseFuelBurnKg]);

  // 3D Geometry Generation based on airframe type
  const geometry = useMemo(() => {
    const vertices: Point3D[] = [];
    const edges: Edge[] = [];

    const isQuad = specs.engineCount === 4;
    const isRegional = specs.category.includes("REGIONAL");
    const isWide = specs.category.includes("WIDE-BODY") || specs.category.includes("SUPER-HEAVY");

    const fuselageLen = isWide ? 170 : 150;
    const fuselageR = isWide ? (isQuad ? 15 : 13) : 10;
    const wingSpan = isQuad ? 155 : isWide ? 135 : 105;
    const wingSweep = isWide ? 42 : 36;

    const addVertex = (x: number, y: number, z: number): number => {
      vertices.push([x, y, z]);
      return vertices.length - 1;
    };

    const addEdge = (v1: number, v2: number, type: Edge[2]) => {
      edges.push([v1, v2, type]);
    };

    // ── 1. FUSELAGE RIBS (8 Cross-Sections along Z from Nose to Tail) ──
    const ribZ = [
      fuselageLen * 0.52,
      fuselageLen * 0.42,
      fuselageLen * 0.25,
      fuselageLen * 0.05,
      -fuselageLen * 0.15,
      -fuselageLen * 0.35,
      -fuselageLen * 0.48,
      -fuselageLen * 0.58,
    ];

    const ribRadii = [
      1.5,
      fuselageR * 0.7,
      fuselageR,
      fuselageR,
      fuselageR,
      fuselageR * 0.85,
      fuselageR * 0.45,
      0.8,
    ];

    const ribOffsetsY = [-2, 0, 1, 0, 0, 1, 3, 5];

    const numPointsPerRing = 8;
    const rings: number[][] = [];

    for (let i = 0; i < ribZ.length; i++) {
      const ring: number[] = [];
      const z = ribZ[i];
      const r = ribRadii[i];
      const yOff = ribOffsetsY[i];

      for (let j = 0; j < numPointsPerRing; j++) {
        const theta = (j / numPointsPerRing) * Math.PI * 2;
        const yStretch = isQuad && i >= 2 && i <= 5 ? 1.25 : 1.0;
        const vx = Math.cos(theta) * r;
        const vy = Math.sin(theta) * r * yStretch + yOff;
        ring.push(addVertex(vx, vy, z));
      }
      rings.push(ring);

      for (let j = 0; j < numPointsPerRing; j++) {
        const next = (j + 1) % numPointsPerRing;
        addEdge(ring[j], ring[next], "fuselage");
      }
    }

    for (let i = 0; i < ribZ.length - 1; i++) {
      for (let j = 0; j < numPointsPerRing; j += 2) {
        addEdge(rings[i][j], rings[i + 1][j], "fuselage");
      }
    }

    // Cockpit Window Frame
    const cockpitTopL = rings[2][2];
    const cockpitTopR = rings[2][1];
    const noseTop = rings[1][1];
    addEdge(cockpitTopL, noseTop, "detail");
    addEdge(cockpitTopR, noseTop, "detail");

    // ── 2. MAIN SWEPT WINGS ──
    const wingRootZ = 8;
    const wingTipZ = wingRootZ - wingSweep;
    const dihedralY = isWide ? 4 : 2;

    // Left Wing
    const leftRootLE = addVertex(-fuselageR * 0.9, 0, wingRootZ + 16);
    const leftRootTE = addVertex(-fuselageR * 0.9, 0, wingRootZ - 20);
    const leftTipLE = addVertex(-wingSpan, dihedralY + 8, wingTipZ);
    const leftTipTE = addVertex(-wingSpan + 6, dihedralY + 8, wingTipZ - 14);
    const leftWinglet = addVertex(-wingSpan - 1, dihedralY + 18, wingTipZ - 4);

    addEdge(leftRootLE, leftTipLE, "wing");
    addEdge(leftTipLE, leftTipTE, "wing");
    addEdge(leftTipTE, leftRootTE, "wing");
    addEdge(leftRootTE, leftRootLE, "wing");
    addEdge(leftTipLE, leftWinglet, "wing");
    addEdge(leftTipTE, leftWinglet, "wing");

    const leftMidLE = addVertex(-wingSpan * 0.5, dihedralY + 4, wingRootZ + 8 - wingSweep * 0.5);
    const leftMidTE = addVertex(-wingSpan * 0.5 + 4, dihedralY + 4, wingRootZ - 12 - wingSweep * 0.5);
    addEdge(leftMidLE, leftMidTE, "detail");

    // Right Wing
    const rightRootLE = addVertex(fuselageR * 0.9, 0, wingRootZ + 16);
    const rightRootTE = addVertex(fuselageR * 0.9, 0, wingRootZ - 20);
    const rightTipLE = addVertex(wingSpan, dihedralY + 8, wingTipZ);
    const rightTipTE = addVertex(wingSpan - 6, dihedralY + 8, wingTipZ - 14);
    const rightWinglet = addVertex(wingSpan + 1, dihedralY + 18, wingTipZ - 4);

    addEdge(rightRootLE, rightTipLE, "wing");
    addEdge(rightTipLE, rightTipTE, "wing");
    addEdge(rightTipTE, rightRootTE, "wing");
    addEdge(rightRootTE, rightRootLE, "wing");
    addEdge(rightTipLE, rightWinglet, "wing");
    addEdge(rightTipTE, rightWinglet, "wing");

    const rightMidLE = addVertex(wingSpan * 0.5, dihedralY + 4, wingRootZ + 8 - wingSweep * 0.5);
    const rightMidTE = addVertex(wingSpan * 0.5 - 4, dihedralY + 4, wingRootZ - 12 - wingSweep * 0.5);
    addEdge(rightMidLE, rightMidTE, "detail");

    // ── 3. TURBOFAN ENGINE NACELLES ──
    const nacelleR = isWide ? 6.5 : 4.8;
    const nacelleLen = isWide ? 22 : 17;

    const buildEngine = (x: number, y: number, z: number) => {
      const frontRing: number[] = [];
      const rearRing: number[] = [];
      const fanCenter = addVertex(x, y, z + nacelleLen * 0.5);
      const exhaustCenter = addVertex(x, y, z - nacelleLen * 0.5);

      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const ex = x + Math.cos(a) * nacelleR;
        const ey = y + Math.sin(a) * nacelleR;
        const vFront = addVertex(ex, ey, z + nacelleLen * 0.5);
        const vRear = addVertex(ex, ey, z - nacelleLen * 0.5);
        frontRing.push(vFront);
        rearRing.push(vRear);
        addEdge(vFront, vRear, "engine");
      }

      for (let k = 0; k < 6; k++) {
        const next = (k + 1) % 6;
        addEdge(frontRing[k], frontRing[next], "engine");
        addEdge(rearRing[k], rearRing[next], "engine");
      }

      addEdge(fanCenter, frontRing[0], "detail");
      addEdge(fanCenter, frontRing[3], "detail");

      const pylonTop = addVertex(x, y + nacelleR + 3, z);
      addEdge(addVertex(x, y + nacelleR, z), pylonTop, "detail");

      return { fanCenter, exhaustCenter, x, y, z: z - nacelleLen * 0.5 };
    };

    const engineExhausts: { x: number; y: number; z: number }[] = [];

    if (isRegional) {
      const engL = buildEngine(-fuselageR - 4, 3, -fuselageLen * 0.34);
      const engR = buildEngine(fuselageR + 4, 3, -fuselageLen * 0.34);
      engineExhausts.push(engL, engR);
    } else if (isQuad) {
      const innerX = wingSpan * 0.34;
      const outerX = wingSpan * 0.68;
      const eng1 = buildEngine(-innerX, -fuselageR * 0.8, wingRootZ - 2);
      const eng2 = buildEngine(-outerX, -fuselageR * 0.5, wingRootZ - 18);
      const eng3 = buildEngine(innerX, -fuselageR * 0.8, wingRootZ - 2);
      const eng4 = buildEngine(outerX, -fuselageR * 0.5, wingRootZ - 18);
      engineExhausts.push(eng1, eng2, eng3, eng4);
    } else {
      const engDistX = wingSpan * 0.38;
      const engL = buildEngine(-engDistX, -fuselageR * 0.75, wingRootZ);
      const engR = buildEngine(engDistX, -fuselageR * 0.75, wingRootZ);
      engineExhausts.push(engL, engR);
    }

    // ── 4. TAIL ASSEMBLY (Vertical Stabilizer & Elevators) ──
    const tailRootZ = -fuselageLen * 0.42;
    const tailTipZ = -fuselageLen * 0.56;
    const finHeight = isWide ? 38 : 30;

    const finBaseLE = addVertex(0, fuselageR * 0.7 + 2, tailRootZ);
    const finBaseTE = addVertex(0, fuselageR * 0.5 + 4, tailTipZ);
    const finTipLE = addVertex(0, finHeight, tailTipZ + 6);
    const finTipTE = addVertex(0, finHeight, tailTipZ - 4);

    addEdge(finBaseLE, finTipLE, "stabilizer");
    addEdge(finTipLE, finTipTE, "stabilizer");
    addEdge(finTipTE, finBaseTE, "stabilizer");

    if (isRegional) {
      const tSpan = 28;
      const tElevL = addVertex(-tSpan, finHeight, finTipTE - 4);
      const tElevR = addVertex(tSpan, finHeight, finTipTE - 4);
      addEdge(finTipTE, tElevL, "stabilizer");
      addEdge(finTipTE, tElevR, "stabilizer");
      addEdge(tElevL, finTipLE, "stabilizer");
      addEdge(tElevR, finTipLE, "stabilizer");
    } else {
      const elevSpan = isWide ? 44 : 32;
      const elevY = 3;
      const elevL = addVertex(-elevSpan, elevY, tailTipZ);
      const elevR = addVertex(elevSpan, elevY, tailTipZ);
      const elevRootLE = addVertex(0, elevY, tailRootZ - 8);
      const elevRootTE = addVertex(0, elevY, tailTipZ - 4);

      addEdge(elevRootLE, elevL, "stabilizer");
      addEdge(elevL, elevRootTE, "stabilizer");
      addEdge(elevRootLE, elevR, "stabilizer");
      addEdge(elevR, elevRootTE, "stabilizer");
    }

    return { vertices, edges, engineExhausts };
  }, [specs]);

  const applyViewPreset = useCallback((preset: "iso" | "top" | "front" | "side") => {
    setActiveView(preset);
    setIsAutoOrbit(false);
    switch (preset) {
      case "iso":
        targetAngles.current = { pitch: -22, yaw: 35, roll: 0 };
        break;
      case "top":
        targetAngles.current = { pitch: -89, yaw: 0, roll: 0 };
        break;
      case "front":
        targetAngles.current = { pitch: 0, yaw: 0, roll: 0 };
        break;
      case "side":
        targetAngles.current = { pitch: 0, yaw: 90, roll: 0 };
        break;
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    setIsAutoOrbit(false);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    targetAngles.current.yaw += dx * 0.7;
    targetAngles.current.pitch = Math.max(-89, Math.min(89, targetAngles.current.pitch + dy * 0.6));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    let pulseTime = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const render = () => {
      pulseTime += 0.04;

      if (isAutoOrbit && !isDragging.current) {
        targetAngles.current.yaw = (targetAngles.current.yaw + 0.35) % 360;
      }

      currentAngles.current.pitch += (targetAngles.current.pitch - currentAngles.current.pitch) * 0.12;
      currentAngles.current.yaw += (targetAngles.current.yaw - currentAngles.current.yaw) * 0.12;
      currentAngles.current.roll += (targetAngles.current.roll - currentAngles.current.roll) * 0.12;

      setPitch(Math.round(currentAngles.current.pitch));
      setYaw(Math.round(currentAngles.current.yaw));
      setRoll(Math.round(currentAngles.current.roll));

      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.fillStyle = "#070A12";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(62, 207, 142, 0.035)";
      ctx.lineWidth = 1;
      const gridSize = 16 * (window.devicePixelRatio || 1);
      ctx.beginPath();
      for (let x = 0; x < w; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      const radPitch = (currentAngles.current.pitch * Math.PI) / 180;
      const radYaw = (currentAngles.current.yaw * Math.PI) / 180;
      const radRoll = (currentAngles.current.roll * Math.PI) / 180;

      const cosP = Math.cos(radPitch), sinP = Math.sin(radPitch);
      const cosY = Math.cos(radYaw), sinY = Math.sin(radYaw);
      const cosR = Math.cos(radRoll), sinR = Math.sin(radRoll);

      const cx = w / 2;
      const cy = h / 2 + 6;
      const scaleFactor = Math.min(w, h) * 0.0036;

      const projected: { sx: number; sy: number; sz: number }[] = [];
      const camDist = 320;

      for (let i = 0; i < geometry.vertices.length; i++) {
        const [x0, y0, z0] = geometry.vertices[i];

        const x1 = x0 * cosY + z0 * sinY;
        const y1 = y0;
        const z1 = -x0 * sinY + z0 * cosY;

        const x2 = x1;
        const y2 = y1 * cosP - z1 * sinP;
        const z2 = y1 * sinP + z1 * cosP;

        const x3 = x2 * cosR - y2 * sinR;
        const y3 = x2 * sinR + y2 * cosR;
        const z3 = z2;

        const depth = camDist / (camDist - z3 * scaleFactor * 0.4);
        const sx = cx + x3 * scaleFactor * depth;
        const sy = cy - y3 * scaleFactor * depth;

        projected.push({ sx, sy, sz: z3 });
      }

      geometry.engineExhausts.forEach((eng) => {
        const x1 = eng.x * cosY + eng.z * sinY;
        const y1 = eng.y;
        const z1 = -eng.x * sinY + eng.z * cosY;

        const x2 = x1;
        const y2 = y1 * cosP - z1 * sinP;
        const z2 = y1 * sinP + z1 * cosP;

        const depth = camDist / (camDist - z2 * scaleFactor * 0.4);
        const ex = cx + x2 * scaleFactor * depth;
        const ey = cy - y2 * scaleFactor * depth;

        const glowR = (8 + Math.sin(pulseTime * 4) * 2) * thrustScale * (window.devicePixelRatio || 1);

        const radGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, glowR * 2.2);
        if (thrustScale > 1.3) {
          radGrad.addColorStop(0, "rgba(245, 158, 11, 0.85)");
          radGrad.addColorStop(0.5, "rgba(62, 207, 142, 0.4)");
          radGrad.addColorStop(1, "rgba(62, 207, 142, 0)");
        } else {
          radGrad.addColorStop(0, "rgba(0, 240, 255, 0.9)");
          radGrad.addColorStop(0.4, "rgba(62, 207, 142, 0.45)");
          radGrad.addColorStop(1, "rgba(62, 207, 142, 0)");
        }

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(ex, ey, glowR * 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(ex, ey, 1.8 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
        ctx.fill();
      });

      geometry.edges.forEach(([v1, v2, type]) => {
        const p1 = projected[v1];
        const p2 = projected[v2];
        const avgZ = (p1.sz + p2.sz) / 2;

        const depthAlpha = Math.max(0.35, Math.min(1.0, 0.75 + avgZ * 0.0035));

        switch (type) {
          case "wing":
            ctx.strokeStyle = `rgba(62, 207, 142, ${0.9 * depthAlpha})`;
            ctx.lineWidth = 1.4 * (window.devicePixelRatio || 1);
            break;
          case "engine":
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.95 * depthAlpha})`;
            ctx.lineWidth = 1.3 * (window.devicePixelRatio || 1);
            break;
          case "stabilizer":
            ctx.strokeStyle = `rgba(167, 139, 250, ${0.85 * depthAlpha})`;
            ctx.lineWidth = 1.2 * (window.devicePixelRatio || 1);
            break;
          case "fuselage":
            ctx.strokeStyle = `rgba(226, 232, 240, ${0.65 * depthAlpha})`;
            ctx.lineWidth = 1.1 * (window.devicePixelRatio || 1);
            break;
          case "detail":
          default:
            ctx.strokeStyle = `rgba(71, 85, 105, ${0.4 * depthAlpha})`;
            ctx.lineWidth = 0.8 * (window.devicePixelRatio || 1);
            break;
        }

        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      });

      const chSize = 10 * (window.devicePixelRatio || 1);
      ctx.strokeStyle = "rgba(62, 207, 142, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - chSize, cy);
      ctx.lineTo(cx + chSize, cy);
      ctx.moveTo(cx, cy - chSize);
      ctx.lineTo(cx, cy + chSize);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [geometry, isAutoOrbit, thrustScale]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[220px] bg-[#070A12] rounded-2xl border border-white/10 overflow-hidden select-none flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_8px_20px_rgba(0,0,0,0.5)] ${className}`}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0 touch-none"
      />

      <div className="relative z-10 p-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 backdrop-blur-md">
            <Crosshair className="w-3 h-3 text-[#3ECF8E]" />
            <span className="font-mono text-[10px] font-semibold tracking-wider text-neutral-200 uppercase">
              {specs.category}
            </span>
          </div>
          <span className="font-mono text-[9px] text-neutral-400">
            0x{icao24.toUpperCase().replace("0X", "")}
          </span>
        </div>

        <div className="flex items-center gap-1 pointer-events-auto bg-[#0C111D]/90 p-1 rounded-lg border border-white/10 shadow-sm backdrop-blur-md">
          <button
            type="button"
            onClick={() => applyViewPreset("iso")}
            title="Isometric 3D View"
            className={`px-1.5 py-0.5 text-[9px] font-mono rounded font-semibold transition-all duration-120 active:scale-[0.95] ${
              activeView === "iso"
                ? "bg-[#3ECF8E] text-black shadow-xs"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            3D
          </button>
          <button
            type="button"
            onClick={() => applyViewPreset("top")}
            title="Planform Top View"
            className={`px-1.5 py-0.5 text-[9px] font-mono rounded font-semibold transition-all duration-120 active:scale-[0.95] ${
              activeView === "top"
                ? "bg-[#3ECF8E] text-black shadow-xs"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            TOP
          </button>
          <button
            type="button"
            onClick={() => applyViewPreset("front")}
            title="Front Elevation View"
            className={`px-1.5 py-0.5 text-[9px] font-mono rounded font-semibold transition-all duration-120 active:scale-[0.95] ${
              activeView === "front"
                ? "bg-[#3ECF8E] text-black shadow-xs"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            FRONT
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAutoOrbit((prev) => !prev);
              setActiveView("iso");
            }}
            title={isAutoOrbit ? "Pause Auto-Orbit" : "Resume Auto-Orbit"}
            className={`p-1 text-[9px] font-mono rounded transition-all duration-120 active:scale-[0.95] ${
              isAutoOrbit ? "text-[#3ECF8E] bg-emerald-500/10" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <RotateCcw className={`w-2.5 h-2.5 ${isAutoOrbit ? "animate-spin" : ""}`} style={{ animationDuration: "8s" }} />
          </button>
        </div>
      </div>

      <div className="relative z-10 px-3 flex items-center justify-between pointer-events-none text-[8.5px] font-mono text-neutral-500 tracking-wider">
        <div className="flex items-center gap-2">
          <span>PITCH: <strong className="text-neutral-300 font-semibold">{pitch}°</strong></span>
          <span>YAW: <strong className="text-neutral-300 font-semibold">{yaw}°</strong></span>
        </div>
        <div className="flex items-center gap-1 text-emerald-400/80">
          <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
          <span>THRUST: {(thrustScale * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="relative z-10 p-3 pt-0 flex items-end justify-between pointer-events-none">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-white tracking-tight">
            <span>SPAN: {specs.wingspanM}m</span>
            <span className="text-neutral-600">·</span>
            <span>LEN: {specs.lengthM}m</span>
          </div>
          <div className="text-[9px] font-mono text-neutral-400 flex items-center gap-1.5">
            <span>{specs.engineModel}</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-300 tabular-nums">ALT: {altitudeFt.toLocaleString()} FT</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0C111D]/90 border border-white/10 text-[9.5px] font-mono text-neutral-300 shadow-xs backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] animate-pulse" />
          <span className="text-neutral-200">1090 MHz Lock</span>
        </div>
      </div>
    </div>
  );
}

