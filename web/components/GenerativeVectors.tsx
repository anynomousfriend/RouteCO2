import React from "react";

interface VectorProps {
  className?: string;
  size?: number;
  opacity?: number;
}

/**
 * Algorithmic radial lines, concentric calibration rings, and compass degree ticks.
 * Rendered in hairline charcoal (#111111).
 */
export function RadialGridArt({ className = "w-24 h-24", size, opacity = 0.22 }: VectorProps) {
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
  const radials = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="#111111"
      style={{ opacity }}
      aria-hidden="true"
    >
      {/* Concentric Calibration Rings */}
      <circle cx="100" cy="100" r="92" strokeWidth="0.8" strokeDasharray="2 3" />
      <circle cx="100" cy="100" r="72" strokeWidth="0.6" />
      <circle cx="100" cy="100" r="50" strokeWidth="0.8" strokeDasharray="1 2" />
      <circle cx="100" cy="100" r="28" strokeWidth="0.6" />
      <circle cx="100" cy="100" r="8" strokeWidth="0.8" />
      <circle cx="100" cy="100" r="1.5" fill="#111111" stroke="none" />

      {/* Radial Rays */}
      {radials.map((deg) => (
        <line
          key={`rad-${deg}`}
          x1="100"
          y1="100"
          x2={100 + 92 * Math.cos((deg * Math.PI) / 180)}
          y2={100 + 92 * Math.sin((deg * Math.PI) / 180)}
          strokeWidth="0.6"
          strokeDasharray={deg % 90 === 0 ? undefined : "3 3"}
        />
      ))}

      {/* Compass Perimeter Ticks */}
      {ticks.map((deg) => {
        const isMajor = deg % 30 === 0;
        const r1 = isMajor ? 84 : 88;
        const r2 = 92;
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={`tick-${deg}`}
            x1={100 + r1 * Math.cos(rad)}
            y1={100 + r1 * Math.sin(rad)}
            x2={100 + r2 * Math.cos(rad)}
            y2={100 + r2 * Math.sin(rad)}
            strokeWidth={isMajor ? "1" : "0.5"}
          />
        );
      })}
    </svg>
  );
}

/**
 * Mathematical 3D elevation contour lines / topological curves.
 * Anchored in backgrounds of certificates, cards, or summary headers.
 */
export function TopologicalContourArt({ className = "w-full h-full", opacity = 0.16 }: VectorProps) {
  return (
    <svg
      viewBox="0 0 800 400"
      className={className}
      preserveAspectRatio="none"
      fill="none"
      stroke="#111111"
      style={{ opacity }}
      aria-hidden="true"
    >
      <path
        d="M -50 80 Q 150 20 350 110 T 750 70 T 900 130"
        strokeWidth="0.75"
        fill="none"
      />
      <path
        d="M -50 110 Q 140 50 360 140 T 740 100 T 900 160"
        strokeWidth="0.75"
        fill="none"
      />
      <path
        d="M -50 140 Q 130 80 370 170 T 730 130 T 900 190"
        strokeWidth="0.9"
        fill="none"
      />
      <path
        d="M -50 170 Q 120 110 380 200 T 720 160 T 900 220"
        strokeWidth="0.75"
        fill="none"
      />
      <path
        d="M -50 200 Q 110 140 390 230 T 710 190 T 900 250"
        strokeWidth="0.75"
        fill="none"
      />
      <path
        d="M -50 230 Q 100 170 400 260 T 700 220 T 900 280"
        strokeWidth="0.8"
        strokeDasharray="4 2"
        fill="none"
      />
      <path
        d="M -50 260 Q 90 200 410 290 T 690 250 T 900 310"
        strokeWidth="0.75"
        fill="none"
      />
      <path
        d="M -50 290 Q 80 230 420 320 T 680 280 T 900 340"
        strokeWidth="0.75"
        fill="none"
      />
      <path
        d="M -50 320 Q 70 260 430 350 T 670 310 T 900 370"
        strokeWidth="0.9"
        fill="none"
      />
      <path
        d="M -50 350 Q 60 290 440 380 T 660 340 T 900 400"
        strokeWidth="0.75"
        fill="none"
      />
    </svg>
  );
}

/**
 * Precision mathematical moiré / hairline grid matrix.
 */
export function MoireLineArt({ className = "w-full h-12", opacity = 0.18 }: VectorProps) {
  const lines = Array.from({ length: 48 }, (_, i) => i);
  return (
    <svg
      viewBox="0 0 600 60"
      className={className}
      preserveAspectRatio="none"
      fill="none"
      stroke="#111111"
      style={{ opacity }}
      aria-hidden="true"
    >
      {lines.map((i) => {
        const x = i * 12.5;
        return (
          <g key={`m-${i}`}>
            <line x1={x} y1="0" x2={x + 18} y2="60" strokeWidth="0.65" />
            <line x1={x + 9} y1="0" x2={x - 9} y2="60" strokeWidth="0.45" strokeDasharray="1 3" />
          </g>
        );
      })}
    </svg>
  );
}
