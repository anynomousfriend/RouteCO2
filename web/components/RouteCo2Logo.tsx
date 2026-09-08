import React from 'react';

interface RouteCo2LogoProps {
  className?: string;
  size?: number;
}

export function RouteCo2Logo({ className = 'w-10 h-10', size }: RouteCo2LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      fill="none"
      role="img"
      aria-label="RouteCO2 Logo"
    >
      {/* Clean Swiss Monochrome White Background Card */}
      <rect width="120" height="120" rx="26" fill="#FFFFFF" />
      
      {/* Floating Apex (Navigational Route Peak / Altitude Waypoint) */}
      <polygon points="60,20 78,48 42,48" fill="#000000" />
      
      {/* Geometric Lettermark Base: CO2 */}
      <g fill="#000000">
        {/* Letter 'C' */}
        <path d="M41 61 H30 C21.716 61 15 67.716 15 76 C15 84.284 21.716 91 30 91 H41 V83.5 H30 C25.858 83.5 22.5 80.142 22.5 76 C22.5 71.858 25.858 68.5 30 68.5 H41 V61 Z" />
        
        {/* Letter 'O' (Concentric Geometric Ring) */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M60 61 C51.716 61 45 67.716 45 76 C45 84.284 51.716 91 60 91 C68.284 91 75 84.284 75 76 C75 67.716 68.284 61 60 61 Z M60 68.5 C55.858 68.5 52.5 71.858 52.5 76 C52.5 80.142 55.858 83.5 60 83.5 C64.142 83.5 67.5 80.142 67.5 76 C67.5 71.858 64.142 68.5 60 68.5 Z"
        />
        
        {/* Subscript Numeral '2' (Precision Swiss Diagonal & Baseline) */}
        <path d="M79 71.5 C79 65.7 83.7 61 90.5 61 C97.3 61 102 65.7 102 71.5 C102 75.8 99.2 79.2 94.5 83.5 L87.5 87.5 H105 V91 H79 V86.5 L93 78 C96 75.5 97.5 73.2 97.5 71.5 C97.5 68.5 94.8 66 90.5 66 C86.2 66 83.5 68.5 83.5 71.5 H79 Z" />
      </g>
    </svg>
  );
}

export default RouteCo2Logo;
