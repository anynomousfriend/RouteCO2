import React from 'react';

interface LogoProps {
  size?: number;
  color?: string;
  className?: string;
}

/** Official 1inch Vector Wordmark Logo from 1inch.com */
export function OneInchLogo({ size = 22, color = 'currentColor', className = '' }: LogoProps) {
  const width = Math.round((size * 178) / 50);
  return (
    <svg
      viewBox="0 0 178 50"
      width={width}
      height={size}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="1inch"
    >
      <path
        d="M171.358 14.135V0H178V14.135H171.358ZM159.669 14.135V0H166.31V14.135H159.669ZM126.26 49.2968H134.563V31.5049C134.563 23.91 138.548 20.4641 142.134 20.4641C145.721 20.4641 148.046 22.8551 148.046 28.6217V49.2968H156.348V26.8636C156.348 18.6357 152.097 13.4318 145.19 13.4318C140.341 13.4318 136.622 16.1041 134.563 21.9409V0H126.26V49.2968ZM0 49.2968H31.5485V42.2644H19.9254V0H13.0179C12.7522 5.90717 11.1582 7.38397 3.52015 7.38397H0V14.135H11.6231V42.2644H0V49.2968ZM105.14 20.4641C109.257 20.4641 112.512 23.91 112.91 28.8326H121.478C120.283 19.4796 113.774 13.4318 105.14 13.4318C95.7746 13.4318 88.3358 21.097 88.3358 31.7159C88.3358 42.3347 95.7746 50 105.14 50C113.774 50 120.283 44.0225 121.478 34.6695H112.91C112.512 39.5921 109.257 42.9677 105.14 42.9677C101.022 42.9677 96.8373 39.0999 96.8373 31.7159C96.8373 24.3319 100.889 20.4641 105.14 20.4641ZM53.1343 49.2968H61.4366V31.5049C61.4366 23.91 65.4216 20.4641 69.0082 20.4641C72.5948 20.4641 74.9194 22.8551 74.9194 28.6217V49.2968H83.2216V26.8636C83.2216 18.6357 78.9709 13.4318 72.0634 13.4318C67.2149 13.4318 63.4955 16.1041 61.4366 21.9409V14.135H53.1343V49.2968ZM36.5299 0V8.79044H44.8321V0H36.5299ZM36.5299 14.135V49.2968H44.8321V14.135H36.5299Z"
        fill={color}
      />
    </svg>
  );
}

/** Official Arc Logo (Circle Agent Stack on Arc) */
export function CircleLogo({ size = 22, className = '' }: LogoProps) {
  return (
    <img
      src="/arc-logo.png"
      alt="Arc Network"
      width={size}
      height={size}
      className={`inline-block shrink-0 rounded-sm ${className}`}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}

export function PrivyLogo({ size = 22, color = '#D699B6', className = '' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 38 48"
      width={size * 0.8}
      height={size}
      className={className}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Privy"
    >
      <path d="M 18.658 37.189 C 28.96 37.189 37.316 28.862 37.316 18.594 C 37.316 8.326 28.96 0 18.658 0 C 8.355 -0.001 0 8.326 0 18.594 C 0 28.861 8.355 37.188 18.658 37.188 Z M 18.658 48 C 25.699 48 31.408 46.803 31.408 45.333 C 31.408 43.865 25.703 42.667 18.658 42.667 C 11.612 42.667 5.907 43.865 5.907 45.333 C 5.907 46.803 11.612 48 18.658 48 Z" />
    </svg>
  );
}
