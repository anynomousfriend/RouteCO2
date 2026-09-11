"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { RouteCo2Logo } from "@/components/RouteCo2Logo";
import {
  OneInchLogo,
  CircleLogo,
  PrivyLogo,
} from "@/components/PartnerLogos";
import { RadialGridArt, TopologicalContourArt } from "@/components/GenerativeVectors";

interface PartnerLayer {
  idx: string;
  name: string;
  role: string;
  tag: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  logo: React.ReactNode;
  desc: string;
  specs: Array<{ key: string; val: string }>;
  linkText: string;
  linkHref: string;
}

const PARTNERS: PartnerLayer[] = [
  {
    idx: "01",
    name: "1inch Aqua",
    role: "Dynamic SwapVM fuel efficiency curve liquidity layer",
    tag: "1INCH · AQUA",
    accentColor: "#0891B2",
    badgeBg: "rgba(8, 145, 178, 0.10)",
    badgeText: "#0E7490",
    logo: <OneInchLogo size={18} color="#0891B2" />,
    desc: "Settlement requires precision execution. At waypoint crossings or touchdown, RouteCO2 compiles ICAO fuel-efficiency curves directly into SwapVM bytecode. 1inch Aqua executes the atomic swap between airline treasury USDC and tokenized carbon credits with zero fund lockup.",
    specs: [
      { key: "CALL", val: "quote USDC -> carbon-credit token via Aqua shared TVU" },
      { key: "SWAPVM", val: "bytecode fuel curve (_piecewiseLinearScale, _decayXD)" },
      { key: "GUARD", val: "max slippage 0.5% · maker-favorable invariant verification" },
      { key: "SETTLEMENT", val: "atomic aqua.pull() USDC & aqua.push() offset tokens" },
    ],
    linkText: "VIEW 1INCH AQUA CODE ↗",
    linkHref: "https://github.com/anynomousfriend/RouteCO2/blob/main/contracts/src/SkyRouteVault.sol#L160-L193",
  },
  {
    idx: "02",
    name: "Circle Agent Stack on Arc",
    role: "Autonomous dispatcher daemon & native USDC gas",
    tag: "CIRCLE · ARC",
    accentColor: "#FF4D00",
    badgeBg: "rgba(255, 77, 0, 0.10)",
    badgeText: "#FF4D00",
    logo: <CircleLogo size={20} />,
    desc: "Circle's agent infrastructure equips RouteCO2 with an autonomous signing wallet that acts, rather than holds. The dispatcher daemon evaluates real ADS-B signals against ICAO formulas and broadcasts settlements in native USDC on Arc Testnet (Chain ID 5042002) with sub-second finality.",
    specs: [
      { key: "DAEMON", val: "autonomous background worker evaluating live radar state vectors" },
      { key: "NETWORK", val: "Arc Testnet (5042002) · sub-second finality · native USDC gas" },
      { key: "POLICY", val: "≤ 500 USDC per cycle · strictly allowlisted contract boundaries" },
      { key: "CUSTODY", val: "0 : airline treasury funds remain in self-custody until execution" },
    ],
    linkText: "VIEW ARC AGENT SETTLER CODE ↗",
    linkHref: "https://github.com/anynomousfriend/RouteCO2/blob/main/agent/src/agent-wallet-settler.ts#L100-L157",
  },
  {
    idx: "03",
    name: "Privy",
    role: "Passkey onboarding & scoped manifest session keys",
    tag: "PRIVY · AUTH",
    accentColor: "#3ECF8E",
    badgeBg: "rgba(62, 207, 142, 0.12)",
    badgeText: "#15803D",
    logo: <PrivyLogo size={20} color="#3ECF8E" />,
    desc: "Privy equips airline dispatchers and operations directors with biometric passkey authentication (< 3s) and embedded smart wallets. Scoped flight manifest session delegation enforces cryptographic spend caps (≤ 500 USDC) and restricts authorization strictly to SkyRouteVault and Arc USDC.",
    specs: [
      { key: "AUTH", val: "passkeys / WebAuthn · biometric FaceID & TouchID in < 3s" },
      { key: "WALLETS", val: "embedded corporate smart wallets · zero seed-phrase friction" },
      { key: "DELEGATION", val: "manifest session keys bounded to SkyRouteVault · hard spend caps" },
      { key: "SECURITY", val: "zero wallet popups during mid-flight waypoint settlements" },
    ],
    linkText: "VIEW PRIVY DELEGATION CODE ↗",
    linkHref: "https://github.com/anynomousfriend/RouteCO2/blob/main/web/lib/privy-signers.ts#L59-L86",
  },
];

interface FlightScenario {
  callsign: string;
  origin: string;
  destination: string;
  airframeCode: string;
  airframeName: string;
  altitudeFl: number;
  groundSpeedKt: number;
  burnRateKgS: number;
  distanceKm: number;
  fuelBurnKg: number;
  co2Tons: number;
  usdcCost: number;
  creditType: string;
}

const DEMO_FLIGHTS: FlightScenario[] = [
  {
    callsign: "DLH400",
    origin: "EDDF (Frankfurt)",
    destination: "KJFK (New York)",
    airframeCode: "A359",
    airframeName: "Airbus A350-900",
    altitudeFl: 380,
    groundSpeedKt: 492,
    burnRateKgS: 5.35,
    distanceKm: 6200,
    fuelBurnKg: 31200,
    co2Tons: 98.6,
    usdcCost: 1479.0,
    creditType: "Verra VCS-1844 Blue Carbon",
  },
  {
    callsign: "AFR006",
    origin: "LFPG (Paris)",
    destination: "KBOS (Boston)",
    airframeCode: "B789",
    airframeName: "Boeing 787-9 Dreamliner",
    altitudeFl: 390,
    groundSpeedKt: 478,
    burnRateKgS: 4.82,
    distanceKm: 5540,
    fuelBurnKg: 26800,
    co2Tons: 84.7,
    usdcCost: 1270.5,
    creditType: "Gold Standard GS-4209 Clean Biochar",
  },
  {
    callsign: "BAW117",
    origin: "EGLL (London)",
    destination: "KJFK (New York)",
    airframeCode: "A35K",
    airframeName: "Airbus A350-1000",
    altitudeFl: 360,
    groundSpeedKt: 485,
    burnRateKgS: 5.68,
    distanceKm: 5560,
    fuelBurnKg: 28400,
    co2Tons: 89.7,
    usdcCost: 1345.5,
    creditType: "Puro.earth CORC-912 Enhanced Weathering",
  },
];

interface SettlementReceipt {
  txHash: string;
  blockNumber: number;
  finalityMs: number;
  route: string;
  usdcAmount: string;
  co2Retired: string;
  certificateId: string;
  creditType: string;
}

const FAQS = [
  {
    question: "How does RouteCO2 verify that an aircraft actually flew and burned fuel?",
    answer:
      "RouteCO2 ingests raw ADS-B transponder state vectors from the OpenSky Network. Every state vector contains geometric coordinates, altitude, ground speed, vertical climb velocity, and a unique 24-bit ICAO airframe hex. These inputs are evaluated in real time against ICAO Doc 9889 airframe polynomial tables to calculate physical fuel burn and resulting CO2 mass.",
  },
  {
    question: "Why does RouteCO2 use 1inch Aqua instead of traditional DEX pools?",
    answer:
      "Traditional AMMs require airlines to lock working capital into custodial liquidity pools or escrow smart contracts. 1inch Aqua's shared TVU architecture allows airline treasury USDC to remain in the airline's self-custodial smart wallet until the exact second of execution. Furthermore, SwapVM opcodes enable custom mathematical curves that price offsets dynamically based on climb rate penalties and altitude cruise efficiency.",
  },
  {
    question: "What is the purpose of the Circle Agent Stack on Arc Testnet?",
    answer:
      "The Circle Agent Stack provides an autonomous, server-side execution wallet that signs transactions when verified flight conditions are met. Arc Testnet provides sub-second deterministic finality and native USDC gas (Chain ID 5042002), enabling rapid micro-settlements at waypoint crossings without exposure to volatile gas tokens.",
  },
  {
    question: "How does Privy secure corporate airline treasury funds?",
    answer:
      "Privy enables airline dispatchers to authenticate via biometric passkeys (WebAuthn / FaceID) in under three seconds. It provisions an embedded corporate smart wallet with Scoped Flight Manifest Delegation: the background agent is granted bounded session keys capped at a strict spending limit (e.g. 500 USDC per cycle) and restricted exclusively to interacting with SkyRouteVault on Arc.",
  },
  {
    question: "Is this simulated or live in production?",
    answer:
      "The interactive console on this landing page is an illustrative walkthrough of the protocol stages. The production application at /app connects directly to live OpenSky ADS-B radar feeds and broadcasts verifiable on-chain transactions to Arc Testnet (Chain ID 5042002).",
  },
];

const CODE_FILES = [
  {
    path: "contracts/src/SkyRouteVault.sol",
    desc: "1inch Aqua App callback & zero-custody settlement pull (aqua.pull) on Arc Testnet",
    lang: "SOL",
    tag: "1INCH AQUA",
    color: "#0891B2",
    bg: "rgba(8, 145, 178, 0.10)",
    url: "https://github.com/anynomousfriend/RouteCO2/blob/main/contracts/src/SkyRouteVault.sol#L144-L193",
  },
  {
    path: "contracts/src/SwapVMRuleEngine.sol",
    desc: "SwapVM kinematic flight curve interpreter (_dynamicBalancesXD, _piecewiseLinearScale, _flatFeeAmountInXD)",
    lang: "SOL",
    tag: "SWAPVM",
    color: "#0891B2",
    bg: "rgba(8, 145, 178, 0.10)",
    url: "https://github.com/anynomousfriend/RouteCO2/blob/main/contracts/src/SwapVMRuleEngine.sol#L57-L146",
  },
  {
    path: "contracts/src/AquaCore.sol",
    desc: "1inch Aqua shared liquidity registry implementation (ship, dock, pull real USDC)",
    lang: "SOL",
    tag: "AQUA CORE",
    color: "#0891B2",
    bg: "rgba(8, 145, 178, 0.10)",
    url: "https://github.com/anynomousfriend/RouteCO2/blob/main/contracts/src/AquaCore.sol#L26-L75",
  },
  {
    path: "agent/src/agent-wallet-settler.ts",
    desc: "Autonomous settlement via Circle Agent Wallet on Arc Testnet (Chain ID 5042002)",
    lang: "TS",
    tag: "CIRCLE AGENT",
    color: "#FF4D00",
    bg: "rgba(255, 77, 0, 0.10)",
    url: "https://github.com/anynomousfriend/RouteCO2/blob/main/agent/src/agent-wallet-settler.ts#L100-L157",
  },
  {
    path: "agent/src/circle-cli-agent.ts",
    desc: "Circle CLI agent client with testnet spending-policy gating and contract allowlists",
    lang: "TS",
    tag: "AGENT STACK",
    color: "#FF4D00",
    bg: "rgba(255, 77, 0, 0.10)",
    url: "https://github.com/anynomousfriend/RouteCO2/blob/main/agent/src/circle-cli-agent.ts#L20-L80",
  },
  {
    path: "web/lib/arc-client.ts",
    desc: "Arc Testnet viem client & contract bindings (sub-second finality, native USDC gas)",
    lang: "TS",
    tag: "ARC L1",
    color: "#FF4D00",
    bg: "rgba(255, 77, 0, 0.10)",
    url: "https://github.com/anynomousfriend/RouteCO2/blob/main/web/lib/arc-client.ts#L11-L28",
  },
  {
    path: "web/lib/privy-signers.ts",
    desc: "Privy scoped session delegation signers with spend caps & contract whitelists",
    lang: "TS",
    tag: "PRIVY",
    color: "#3ECF8E",
    bg: "rgba(62, 207, 142, 0.12)",
    url: "https://github.com/anynomousfriend/RouteCO2/blob/main/web/lib/privy-signers.ts#L59-L86",
  },
  {
    path: "web/lib/privy-config.ts",
    desc: "Privy passkey onboarding configuration with embedded smart wallets on Arc Testnet",
    lang: "TS",
    tag: "PRIVY",
    color: "#3ECF8E",
    bg: "rgba(62, 207, 142, 0.12)",
    url: "https://github.com/anynomousfriend/RouteCO2/blob/main/web/lib/privy-config.ts#L47-L66",
  },
  {
    path: "agent/src/swapvm-compiler.ts",
    desc: "Dynamic flight efficiency curve to SwapVM off-chain bytecode compiler",
    lang: "TS",
    tag: "1INCH",
    color: "#0891B2",
    bg: "rgba(8, 145, 178, 0.10)",
    url: "https://github.com/anynomousfriend/RouteCO2/blob/main/agent/src/swapvm-compiler.ts#L80-L135",
  },
  {
    path: "agent/src/icao-engine.ts",
    desc: "ICAO Doc 9889 airframe polynomial fuel burn & CO2 emissions engine",
    lang: "TS",
    tag: "ICAO MATH",
    color: "#555555",
    bg: "rgba(85, 85, 85, 0.10)",
    url: "https://github.com/anynomousfriend/RouteCO2/blob/main/agent/src/icao-engine.ts#L85-L160",
  },
];

export default function LandingPage() {
  const [activePartner, setActivePartner] = useState<number>(0);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [zuluTime, setZuluTime] = useState<string>("00:00:00Z");
  const [copied, setCopied] = useState<boolean>(false);

  // Interactive Simulator State
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number>(0);
  const [cycleRunning, setCycleRunning] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [consoleLogs, setConsoleLogs] = useState<Array<{ text: string; tag?: string }>>([]);
  const [receipt, setReceipt] = useState<SettlementReceipt | null>(null);
  const [stats, setStats] = useState({ cycles: 0, co2: 0, usdc: 0 });

  const terminalContainerRef = useRef<HTMLDivElement>(null);

  // Ensure initial page load lands on the hero section when no anchor hash is present
  useEffect(() => {
    if (typeof window !== "undefined" && !window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, []);

  // Zulu Clock
  useEffect(() => {
    const updateZulu = () => {
      const now = new Date();
      setZuluTime(now.toISOString().slice(11, 19) + "Z");
    };
    updateZulu();
    const interval = setInterval(updateZulu, 1000);
    return () => clearInterval(interval);
  }, []);

  // Scroll Entry Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    const elements = document.querySelectorAll(".scroll-entry");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Auto-scroll terminal log internally without moving page viewport
  useEffect(() => {
    if (consoleLogs.length > 0 && terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [consoleLogs]);

  // Copy Clone Command
  const handleCopyClone = async () => {
    try {
      await navigator.clipboard.writeText(
        "git clone https://github.com/anynomousfriend/RouteCO2.git"
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  const currentScenario = DEMO_FLIGHTS[selectedScenarioIdx];

  // Run Dispatch Simulation Cycle
  const runSimulationCycle = async () => {
    if (cycleRunning) return;
    setCycleRunning(true);
    setReceipt(null);
    setConsoleLogs([]);

    const scenario = currentScenario;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const steps = [
      {
        step: 0,
        logs: [
          {
            text: `[OPENSKY] Polling live ADS-B state vectors · corridor ${scenario.origin} -> ${scenario.destination}`,
            tag: "ADS-B",
          },
          {
            text: `[RADAR] Target lock: ${scenario.callsign} (${scenario.airframeCode}) · FL${scenario.altitudeFl} · GS ${scenario.groundSpeedKt} KT`,
            tag: "RADAR",
          },
        ],
      },
      {
        step: 1,
        logs: [
          {
            text: `[ICAO] Ingesting Doc 9889 polynomial curves for ${scenario.airframeName}`,
            tag: "ICAO",
          },
          {
            text: `[ICAO] Kinematic fuel rate: ${scenario.burnRateKgS} kg/s -> ${scenario.fuelBurnKg.toLocaleString()} kg fuel (${scenario.co2Tons.toFixed(1)} t CO2e)`,
            tag: "CALC",
          },
        ],
      },
      {
        step: 2,
        logs: [
          {
            text: `[1INCH] Compiling dynamic SwapVM curve bytecode (_piecewiseLinearScale, _decayXD)`,
            tag: "SWAPVM",
          },
          {
            text: `[1INCH] Quoting Aqua shared TVU: $${scenario.usdcCost.toFixed(2)} USDC -> ${scenario.co2Tons.toFixed(1)} ${scenario.creditType}`,
            tag: "AQUA",
          },
        ],
      },
      {
        step: 3,
        logs: [
          {
            text: `[CIRCLE] Verified flight manifest spend limits: $${scenario.usdcCost.toFixed(2)} <= $500.00 cycle cap`,
            tag: "POLICY",
          },
          {
            text: `[CIRCLE] Autonomous developer-controlled wallet signed payload with zero user friction`,
            tag: "SIGN",
          },
        ],
      },
      {
        step: 4,
        logs: [
          {
            text: `[ARC] Broadcasting atomic settlement transaction to Arc Testnet (Chain ID 5042002)`,
            tag: "TX",
          },
          {
            text: `[ARC] Sub-second block inclusion confirmed in 680 ms · Native USDC gas execution`,
            tag: "ARC L1",
          },
        ],
      },
      {
        step: 5,
        logs: [
          {
            text: `[RETIREMENT] Carbon credit certificate minted and burned for flight ${scenario.callsign}`,
            tag: "CERT",
          },
          {
            text: `[CLEARED] Settlement complete · 0 treasury escrow lockup · Cryptographic receipt issued`,
            tag: "DONE",
          },
        ],
      },
    ];

    for (const s of steps) {
      setCurrentStep(s.step);
      for (const log of s.logs) {
        setConsoleLogs((prev) => [...prev, log]);
        await sleep(320);
      }
      await sleep(180);
    }

    const txHash =
      "0x" +
      Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
    const blockNum = 1142980 + stats.cycles * 14 + Math.floor(Math.random() * 5);
    const certId =
      "RET-" +
      Array.from({ length: 8 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      )
        .join("")
        .toUpperCase();

    setReceipt({
      txHash: txHash.slice(0, 10) + "..." + txHash.slice(-8),
      blockNumber: blockNum,
      finalityMs: 680,
      route: `USDC -> ${scenario.creditType.split(" ")[0]} via 1inch Aqua`,
      usdcAmount: `$${scenario.usdcCost.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`,
      co2Retired: `${scenario.co2Tons.toFixed(1)} t CO2e`,
      certificateId: certId,
      creditType: scenario.creditType,
    });

    setStats((prev) => ({
      cycles: prev.cycles + 1,
      co2: prev.co2 + scenario.co2Tons,
      usdc: prev.usdc + scenario.usdcCost,
    }));

    setCycleRunning(false);
  };

  const handleReset = () => {
    if (cycleRunning) return;
    setCurrentStep(-1);
    setConsoleLogs([]);
    setReceipt(null);
  };

  return (
    <div className="min-h-screen bg-[#ECEBE6] text-[#111111] font-sans antialiased selection:bg-[#FF4D00] selection:text-white relative">
      {/* Tactical Engineering Micro-Dot Grid Overlay (matching dashboard) */}
      <div className="ops-grain" aria-hidden="true" />

      {/* ================= STICKY COCKPIT TOPBAR ================= */}
      <header className="sticky top-0 z-50 bg-[#ECEBE6]/92 backdrop-blur-md border-b border-[#D4D3CD]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center shrink-0">
            <Link
              href="/"
              className="flex items-center gap-3 text-[#111111] font-bold text-sm tracking-tight group active:scale-[0.97] transition-[transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] select-none py-1"
            >
              <RouteCo2Logo className="w-8 h-8 transition-[transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105 shrink-0" />
              <div className="flex flex-col justify-center">
                <span className="font-mono tracking-wider text-xs font-bold leading-tight text-[#111111]">
                  ROUTECO2
                </span>
                <span className="text-[9px] font-mono text-[#555555] uppercase tracking-[0.16em] leading-tight mt-0.5 whitespace-nowrap">
                  FLIGHT EMISSIONS DISPATCHER
                </span>
              </div>
            </Link>
          </div>

          {/* Tactile Segmented Navigation Strip (Anti-AI Slop Aerospace Rail) */}
          <nav className="hidden lg:flex items-center gap-0.5 p-1 rounded-lg bg-[#DCDAD4]/70 border border-[#D0CFCA] shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] text-[11px] font-mono select-none shrink-0">
            <a
              href="#loop"
              className="group flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap text-[#555555] hover:text-[#111111] hover:bg-[#ECEBE6] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.97] transition-[color,background-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
            >
              <span className="text-[9px] font-bold text-[#888888] group-hover:text-[#FF4D00] transition-colors duration-150">01</span>
              <span className="font-medium tracking-wide">LOOP</span>
            </a>
            <a
              href="#asymmetry"
              className="group flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap text-[#555555] hover:text-[#111111] hover:bg-[#ECEBE6] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.97] transition-[color,background-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
            >
              <span className="text-[9px] font-bold text-[#888888] group-hover:text-[#FF4D00] transition-colors duration-150">02</span>
              <span className="font-medium tracking-wide">ASYMMETRY</span>
            </a>
            <a
              href="#stack"
              className="group flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap text-[#555555] hover:text-[#111111] hover:bg-[#ECEBE6] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.97] transition-[color,background-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
            >
              <span className="text-[9px] font-bold text-[#888888] group-hover:text-[#FF4D00] transition-colors duration-150">03</span>
              <span className="font-medium tracking-wide">STACK</span>
            </a>
            <a
              href="#demo"
              className="group flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap text-[#555555] hover:text-[#111111] hover:bg-[#ECEBE6] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.97] transition-[color,background-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
            >
              <span className="text-[9px] font-bold text-[#888888] group-hover:text-[#FF4D00] transition-colors duration-150">04</span>
              <span className="font-medium tracking-wide">RADAR HUD</span>
            </a>
            <a
              href="#source"
              className="group flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap text-[#555555] hover:text-[#111111] hover:bg-[#ECEBE6] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.97] transition-[color,background-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
            >
              <span className="text-[9px] font-bold text-[#888888] group-hover:text-[#FF4D00] transition-colors duration-150">05</span>
              <span className="font-medium tracking-wide">SOURCE</span>
            </a>
            <a
              href="#faq"
              className="group flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap text-[#555555] hover:text-[#111111] hover:bg-[#ECEBE6] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.97] transition-[color,background-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
            >
              <span className="text-[9px] font-bold text-[#888888] group-hover:text-[#FF4D00] transition-colors duration-150">06</span>
              <span className="font-medium tracking-wide">FAQ</span>
            </a>
          </nav>

          {/* Right Instrument Group: Telemetry Capsule & Tactile Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-[#555555] px-2.5 py-1.5 rounded-md bg-[#DCDAD4]/70 border border-[#D0CFCA] select-none whitespace-nowrap">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4D00] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF4D00]"></span>
              </span>
              <span className="tracking-wider">ARC 5042002</span>
              <span className="text-[#B8B7B0]" aria-hidden="true">|</span>
              <span className="text-[#111111] font-bold tabular-nums tracking-tight">{zuluTime}</span>
            </div>

            <Link
              href="/app"
              className="group inline-flex items-center gap-1.5 bg-[#111111] hover:bg-[#FF4D00] active:scale-[0.97] text-white text-xs font-mono font-semibold px-3.5 py-1.5 rounded-md transition-[background-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:shadow-[0_2px_8px_rgba(255,77,0,0.25)] select-none whitespace-nowrap shrink-0"
            >
              <span className="tracking-wider">ENTER RADAR CONSOLE</span>
              <span className="inline-block transition-[transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0">
                ↗
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* ================= HERO SECTION (COCKPIT OPERATIONS COMMAND) ================= */}
      <section className="py-20 md:py-28 relative overflow-hidden border-b border-[#D4D3CD]">
        {/* Generative Radial Radar Rings in background */}
        <div className="absolute right-6 -top-12 pointer-events-none opacity-40 hidden lg:block">
          <RadialGridArt size={320} className="text-[#111111]" opacity={0.15} />
        </div>
        <div className="absolute left-1/2 -bottom-20 -translate-x-1/2 pointer-events-none opacity-20 w-full h-48">
          <TopologicalContourArt opacity={0.12} />
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          {/* Live Transponder Ribbon & Squawk Status Bar */}
          <div className="scroll-entry mb-6">
            <div className="inline-flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-md border border-[#D4D3CD] bg-[#D6D5CF] text-xs font-mono shadow-xs">
              {/* Squawk Ident */}
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3ECF8E] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3ECF8E]"></span>
                </span>
                <span className="text-[#111111] font-bold tracking-tight">SQUAWK 7000</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#ECEBE6] text-[#111111] border border-[#D4D3CD] font-bold tracking-wider">
                  IDENT
                </span>
              </div>

              <span className="h-3.5 w-px bg-[#BCBBB5] hidden sm:block" aria-hidden="true" />

              {/* Radar Scope */}
              <div className="flex items-center gap-1.5 text-[#555555]">
                <span className="text-[10px] text-[#555555] font-bold uppercase tracking-wider">
                  RADAR:
                </span>
                <span className="text-[#111111] font-bold">OPENSKY ADS-B</span>
                <span className="text-[#555555] text-[11px] hidden md:inline">
                  (EDDF 50.038°N 8.562°E)
                </span>
              </div>

              <span className="h-3.5 w-px bg-[#BCBBB5] hidden md:block" aria-hidden="true" />

              {/* Sweep & Clearance Finality */}
              <div className="flex items-center gap-2.5 text-[#555555]">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D00]"></span>
                  <span className="text-[#111111] font-bold">10s SWEEP</span>
                </div>
                <span className="text-[#BCBBB5] hidden lg:inline">|</span>
                <div className="hidden lg:flex items-center gap-1.5">
                  <span className="text-[#15803D] font-bold">680ms</span>
                  <span className="text-[#555555] text-[11px]">ARC L1 SETTLED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Headline with Cockpit Typography */}
          <h1 className="scroll-entry text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-[#111111] max-w-4xl leading-[1.02]">
            EVERY CONTRAIL <br />
            <span className="font-editorial italic font-normal text-[#555555]">
              settles itself.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="scroll-entry text-base sm:text-lg text-[#555555] leading-relaxed max-w-2xl mt-6">
            RouteCO2 bridges real-time ADS-B radar telemetry directly to autonomous on-chain clearing.
            It evaluates physical airframe kinematics via ICAO Doc 9889 polynomial curves, prices dynamic fuel-efficiency offsets through{" "}
            <strong className="inline-flex items-center gap-1 font-bold text-[#111111] align-baseline">
              <OneInchLogo size={11} color="#0891B2" />
              <span>Aqua</span>
            </strong>{" "}
            SwapVM bytecode, executes autonomous gasless settlements with{" "}
            <strong className="inline-flex items-center gap-1.5 font-bold text-[#111111] align-baseline">
              <CircleLogo size={15} />
              Circle Agent Stack
            </strong>{" "}
            on Arc in native USDC, and enforces corporate treasury spend limits using{" "}
            <strong className="inline-flex items-center gap-1.5 font-bold text-[#111111] align-baseline">
              <PrivyLogo size={14} color="#3ECF8E" />
              Privy
            </strong>{" "}
            session keys. Zero custody. Zero paper invoices. Continuous 10-second finality.
          </p>

          {/* Action Row */}
          <div className="scroll-entry flex flex-wrap items-center gap-3.5 mt-8">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 bg-[#111111] hover:bg-[#FF4D00] active:scale-[0.97] text-white text-xs font-mono font-semibold px-5 py-3 rounded-md transition-all shadow-sm"
            >
              <span>LAUNCH LIVE RADAR CONSOLE</span>
              <span>↗</span>
            </Link>

            <a
              href="#demo"
              className="inline-flex items-center gap-2 bg-[#D6D5CF] border border-[#D4D3CD] text-[#111111] hover:bg-[#ECEBE6] active:scale-[0.97] text-xs font-mono font-semibold px-5 py-3 rounded-md transition-all"
            >
              <span>RUN DISPATCH CYCLE</span>
              <span className="text-xs">↓</span>
            </a>

            <a
              href="https://github.com/anynomousfriend/RouteCO2"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#D6D5CF] border border-[#D4D3CD] text-[#111111] hover:bg-[#ECEBE6] active:scale-[0.97] text-xs font-mono font-semibold px-4 py-3 rounded-md transition-all"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.66.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
              <span>SOURCE</span>
            </a>
          </div>

          {/* Partner Chip Rail */}
          <div className="scroll-entry mt-12 pt-6 border-t border-[#D4D3CD] flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-mono text-[#555555] uppercase tracking-wider mr-1">
              PROTOCOL STACK:
            </span>
            <span
              title="1inch Aqua"
              aria-label="1inch Aqua"
              className="btn-pill inline-flex items-center justify-center h-8 px-2.5 bg-[#D6D5CF] border border-[#D4D3CD] text-[#111111]"
            >
              <OneInchLogo size={12} color="#0891B2" />
            </span>
            <span
              title="Circle Agent Stack"
              aria-label="Circle Agent Stack"
              className="btn-pill inline-flex items-center justify-center w-8 h-8 bg-[#D6D5CF] border border-[#D4D3CD] text-[#111111]"
            >
              <CircleLogo size={16} />
            </span>
            <span
              title="Privy"
              aria-label="Privy"
              className="btn-pill inline-flex items-center justify-center w-8 h-8 bg-[#D6D5CF] border border-[#D4D3CD] text-[#111111]"
            >
              <PrivyLogo size={15} color="#3ECF8E" />
            </span>
          </div>

          {/* Cockpit Telemetry HUD Strip */}
          <div className="scroll-entry mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF]">
              <div className="text-[10px] font-mono text-[#555555] uppercase tracking-wider">
                RADAR SCOPE
              </div>
              <div className="text-sm font-mono text-[#111111] font-bold mt-0.5">
                GLOBAL ADS-B ACTIVE
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF]">
              <div className="text-[10px] font-mono text-[#555555] uppercase tracking-wider">
                BURN MODEL
              </div>
              <div className="text-sm font-mono text-[#111111] font-bold mt-0.5">
                ICAO DOC 9889 TABLES
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF]">
              <div className="text-[10px] font-mono text-[#555555] uppercase tracking-wider">
                FINALITY
              </div>
              <div className="text-sm font-mono text-[#FF4D00] font-bold mt-0.5">
                &lt; 800 MS (ARC L1)
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF]">
              <div className="text-[10px] font-mono text-[#555555] uppercase tracking-wider">
                TREASURY CUSTODY
              </div>
              <div className="text-sm font-mono text-[#111111] font-bold mt-0.5">
                0 ESCROW (SELF-HELD)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SEC 01 : 3-STAGE DISPATCH LOOP (BENTO HUD) ================= */}
      <section id="loop" className="py-20 md:py-28 border-b border-[#D4D3CD]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="scroll-entry">
            <span className="btn-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-wider mb-4 bg-[#D6D5CF] border border-[#D4D3CD] text-[#111111]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D00]"></span>
              EXECUTION LIFECYCLE
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111111]">
              Sense, measure, settle. On a continuous ten-second loop.
            </h2>
            <p className="text-[#555555] text-base md:text-lg max-w-2xl mt-4 leading-relaxed">
              RouteCO2 behaves the way air-traffic control behaves toward a radar blip: continuous transponder
              contact, instantaneous fuel-burn computation, and autonomous clearance delivered in native USDC.
            </p>
          </div>

          {/* Asymmetrical Bento Box Grid */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 01: SENSE */}
            <div className="scroll-entry card-tactile p-7 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="btn-pill px-2.5 py-0.5 text-[10px] font-mono tracking-wider uppercase font-bold bg-[#ECEBE6] text-[#2563EB] border border-[#D4D3CD]">
                    STAGE 01
                  </span>
                  <span className="text-xs font-mono text-[#555555]">OPENSKY</span>
                </div>
                <h3 className="font-mono text-xl font-bold text-[#111111]">01 / SENSE</h3>
                <div className="text-xs font-mono text-[#555555] uppercase tracking-wider mt-1 mb-4">
                  OpenSky ADS-B Telemetry
                </div>
                <p className="text-xs text-[#555555] leading-relaxed">
                  Continuous contact with commercial aircraft in flight. Ingests raw state vectors: geometric
                  altitude, ground velocity, track angle, and transponder fixes without artificial delay.
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-[#D4D3CD] space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#555555]">CADENCE</span>
                  <span className="text-[#111111] font-semibold">10s scope sweep</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555555]">TELEMETRY</span>
                  <span className="text-[#111111] font-semibold">Lat · Lon · FL · GS · VS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555555]">INTEGRITY</span>
                  <span className="text-[#111111] font-semibold">Public ICAO transponders</span>
                </div>
              </div>
            </div>

            {/* Card 02: MEASURE */}
            <div className="scroll-entry card-tactile p-7 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="btn-pill px-2.5 py-0.5 text-[10px] font-mono tracking-wider uppercase font-bold bg-[#ECEBE6] text-[#FF4D00] border border-[#D4D3CD]">
                    STAGE 02
                  </span>
                  <span className="text-xs font-mono text-[#555555]">ICAO ENGINE</span>
                </div>
                <h3 className="font-mono text-xl font-bold text-[#111111]">02 / MEASURE</h3>
                <div className="text-xs font-mono text-[#555555] uppercase tracking-wider mt-1 mb-4">
                  Doc 9889 Kinematics
                </div>
                <p className="text-xs text-[#555555] leading-relaxed">
                  Translates flight kinematics into verified carbon mass before wheels touch the tarmac.
                  Evaluates airframe polynomial curves with altitude cruise discounts and climb thrust scalars.
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-[#D4D3CD] space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#555555]">STANDARD</span>
                  <span className="text-[#111111] font-semibold">ICAO Doc 9889 Tables</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555555]">FACTOR</span>
                  <span className="text-[#111111] font-semibold">3.16 kg CO2 / kg fuel</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555555]">AIRFRAMES</span>
                  <span className="text-[#111111] font-semibold">A359 · B789 · A320 · B77W</span>
                </div>
              </div>
            </div>

            {/* Card 03: SETTLE */}
            <div className="scroll-entry card-tactile p-7 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="btn-pill px-2.5 py-0.5 text-[10px] font-mono tracking-wider uppercase font-bold bg-[#ECEBE6] text-[#3ECF8E] border border-[#D4D3CD]">
                    STAGE 03
                  </span>
                  <span className="text-xs font-mono text-[#555555]">1INCH & ARC</span>
                </div>
                <h3 className="font-mono text-xl font-bold text-[#111111]">03 / SETTLE</h3>
                <div className="text-xs font-mono text-[#555555] uppercase tracking-wider mt-1 mb-4">
                  1inch Aqua & Arc Testnet
                </div>
                <p className="text-xs text-[#555555] leading-relaxed">
                  Instantaneous clearing without custodial intermediaries. Quotes dynamic SwapVM piecewise
                  curves through 1inch Aqua, signed by Circle agent wallets, and finalized on Arc Testnet.
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-[#D4D3CD] space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#555555]">SETTLEMENT</span>
                  <span className="text-[#111111] font-semibold">Atomic aqua.pull() & push()</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555555]">FINALITY</span>
                  <span className="text-[#FF4D00] font-semibold">&lt; 800 ms Arc USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555555]">CUSTODY</span>
                  <span className="text-[#111111] font-semibold">Zero escrow by construction</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SEC 02 : THE ASYMMETRY (PROBLEM BENTO) ================= */}
      <section id="asymmetry" className="py-20 md:py-28 border-b border-[#D4D3CD] bg-[#DFDED9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="scroll-entry">
            <span className="btn-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-wider mb-4 bg-[#D6D5CF] border border-[#D4D3CD] text-[#FF4D00]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D00]"></span>
              THE ASYMMETRY
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111111]">
              Carbon accounting still flies on paper trust weeks behind the aircraft.
            </h2>
            <p className="text-[#555555] text-base md:text-lg max-w-2xl mt-4 leading-relaxed">
              The telemetry to meter aviation emissions already exists in the clear, broadcast unencrypted by
              commercial airframes. The rails to settle against it in seconds now exist too. RouteCO2 closes the gap.
            </p>
          </div>

          {/* 4-Card Stats Grid */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="scroll-entry card-tactile p-6 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF]">
              <div className="text-[11px] font-mono text-[#555555] uppercase tracking-wider">
                SHARE OF GLOBAL CO₂
              </div>
              <div className="text-4xl font-mono font-bold text-[#111111] my-2">2.5%</div>
              <p className="text-xs text-[#555555] leading-relaxed">
                Commercial aviation produces 2.5% of global emissions, with high-altitude radiative forcing doubling
                the true warming impact.
              </p>
            </div>

            <div className="scroll-entry card-tactile p-6 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF]">
              <div className="text-[11px] font-mono text-[#555555] uppercase tracking-wider">
                ANNUAL FLIGHT EMISSIONS
              </div>
              <div className="text-4xl font-mono font-bold text-[#111111] my-2">≈ 900 MT</div>
              <p className="text-xs text-[#555555] leading-relaxed">
                Over 900 megatonnes of carbon emitted annually, with global passenger volume projected to double by
                2040.
              </p>
            </div>

            <div className="scroll-entry card-tactile p-6 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF]">
              <div className="text-[11px] font-mono text-[#555555] uppercase tracking-wider">
                LEGACY SETTLEMENT LAG
              </div>
              <div className="text-4xl font-mono font-bold text-[#FF4D00] my-2">T+45 Days</div>
              <p className="text-xs text-[#555555] leading-relaxed">
                Voluntary offsets travel through chains of custodial brokers, escrow accounts, and manual audit
                batches before retirement.
              </p>
            </div>

            <div className="scroll-entry card-tactile p-6 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF]">
              <div className="text-[11px] font-mono text-[#555555] uppercase tracking-wider">
                ARC L1 FINALITY
              </div>
              <div className="text-4xl font-mono font-bold text-[#3ECF8E] my-2">&lt; 800 ms</div>
              <p className="text-xs text-[#555555] leading-relaxed">
                Instantaneous wheels-down clearing in native USDC with verifiable ArcScan cryptographic receipts and
                zero middleman extraction.
              </p>
            </div>
          </div>

          {/* Triad Comparison */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="scroll-entry card-tactile p-6 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF]">
              <div className="text-xs font-mono text-[#111111] font-bold uppercase tracking-wider">
                TELEMETRY IS OPEN & PUBLIC
              </div>
              <p className="text-xs text-[#555555] mt-2 leading-relaxed">
                Every commercial flight broadcasts continuous unencrypted ADS-B transponder telemetry globally. The
                data needed to meter fuel burn in real time is public and actionable.
              </p>
            </div>

            <div className="scroll-entry card-tactile p-6 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF]">
              <div className="text-xs font-mono text-[#111111] font-bold uppercase tracking-wider">
                LEGACY PIPELINES ARE CUSTODIAL
              </div>
              <p className="text-xs text-[#555555] mt-2 leading-relaxed">
                Traditional carbon brokers hold airline funds in escrow while negotiating bulk credit contracts. Every
                extra counterparty adds latency, custodial risk, and fee extraction.
              </p>
            </div>

            <div className="scroll-entry card-tactile p-6 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF]">
              <div className="text-xs font-mono text-[#111111] font-bold uppercase tracking-wider">
                ROUTECO2 CLOSES THE LOOP
              </div>
              <p className="text-xs text-[#555555] mt-2 leading-relaxed">
                Fuel is burned at cruise altitude; settlement executes atomically at waypoint crossings and touchdown.
                Zero fund lockup, zero paper trust, and verifiable on-chain certificates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SEC 03 : PARTNER PROTOCOL STACK ================= */}
      <section id="stack" className="py-20 md:py-28 border-b border-[#D4D3CD]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="scroll-entry">
            <span className="btn-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-wider mb-4 bg-[#D6D5CF] border border-[#D4D3CD] text-[#111111]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D00]"></span>
              PARTNER ARCHITECTURE
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111111]">
              Three load-bearing layers. One unified engine.
            </h2>
            <p className="text-[#555555] text-base md:text-lg max-w-2xl mt-4 leading-relaxed">
              Every partner technology occupies a non-redundant position in the execution pipeline. Select any layer
              to inspect its wire protocol and contract specifications.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Left Column: Interactive Tab Buttons */}
            <div className="scroll-entry md:col-span-5 space-y-3">
              {PARTNERS.map((p, idx) => {
                const isSelected = activePartner === idx;
                return (
                  <button
                    key={p.idx}
                    type="button"
                    onClick={() => setActivePartner(idx)}
                    className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? "bg-[#D6D5CF] border-[#111111] shadow-sm"
                        : "bg-[#ECEBE6] border-[#D4D3CD] hover:border-[#BCBBB5]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[#555555] font-bold">{p.idx}</span>
                        <span className="text-[#111111]">{p.logo}</span>
                        <div className="font-bold text-sm text-[#111111]">{p.name}</div>
                      </div>
                      <span
                        className="btn-pill px-2 py-0.5 text-[9px] font-mono tracking-wider uppercase font-bold"
                        style={{ backgroundColor: p.badgeBg, color: p.badgeText }}
                      >
                        {p.tag}
                      </span>
                    </div>
                    <div className="text-xs text-[#555555] mt-2 font-mono truncate">{p.role}</div>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Layer Spec Deep Dive */}
            <div className="scroll-entry md:col-span-7">
              <div
                key={activePartner}
                className="p-8 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF] h-full flex flex-col justify-between animate-pane-fade"
              >
                <div>
                  <div className="flex items-center justify-between pb-6 border-b border-[#D4D3CD]">
                    <div className="flex items-center gap-3">
                      <span>{PARTNERS[activePartner].logo}</span>
                      <h3 className="font-mono text-xl font-bold text-[#111111]">
                        {PARTNERS[activePartner].name}
                      </h3>
                    </div>
                    <span
                      className="btn-pill px-2.5 py-0.5 text-xs font-mono tracking-wider uppercase font-bold"
                      style={{
                        backgroundColor: PARTNERS[activePartner].badgeBg,
                        color: PARTNERS[activePartner].badgeText,
                      }}
                    >
                      {PARTNERS[activePartner].tag}
                    </span>
                  </div>

                  <p className="text-xs text-[#555555] leading-relaxed mt-6">
                    {PARTNERS[activePartner].desc}
                  </p>

                  <div className="mt-6 space-y-3">
                    <div className="text-xs font-mono text-[#555555] uppercase tracking-wider font-bold">
                      SPECIFICATIONS & WIRE BINDINGS:
                    </div>
                    <div className="rounded-lg border border-[#D4D3CD] divide-y divide-[#D4D3CD] overflow-hidden bg-[#ECEBE6]">
                      {PARTNERS[activePartner].specs.map((spec) => (
                        <div
                          key={spec.key}
                          className="p-3 flex flex-col sm:flex-row sm:justify-between text-xs font-mono gap-1"
                        >
                          <span className="text-[#555555] font-semibold">{spec.key}</span>
                          <span className="text-[#111111] text-right font-medium">{spec.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-[#D4D3CD] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#555555]">
                    LAYER {PARTNERS[activePartner].idx} OF 03
                  </span>
                  <a
                    href={PARTNERS[activePartner].linkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FF4D00] font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <span>{PARTNERS[activePartner].linkText}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SEC 04 : COCKPIT DISPATCH CONSOLE HUD ================= */}
      <section id="demo" className="py-20 md:py-28 border-b border-[#D4D3CD] bg-[#DFDED9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="scroll-entry">
            <span className="btn-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-wider mb-4 bg-[#D6D5CF] border border-[#D4D3CD] text-[#FF4D00]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D00]"></span>
              COCKPIT OPERATIONS HUD
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111111]">
              Simulate a live dispatch sequence.
            </h2>
            <p className="text-[#555555] text-base md:text-lg max-w-2xl mt-4 leading-relaxed">
              Experience the step-by-step clearing loop: from ADS-B radar contact to SwapVM curve compilation and Arc
              Testnet certificate retirement.
            </p>
            <p className="text-xs font-mono text-[#555555] mt-2">
              DEMO SIMULATION : ILLUSTRATIVE WALKTHROUGH. PRODUCTION CONSOLE (/APP) CONSUMES THE LIVE OPENSKY FEED AND
              BROADCASTS REAL ARC TESTNET TRANSACTIONS.
            </p>
          </div>

          {/* Cockpit Window Chrome Container */}
          <div className="scroll-entry mt-12 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF] overflow-hidden shadow-sm">
            {/* Window Bar */}
            <div className="h-10 px-4 bg-[#D6D5CF] border-b border-[#D4D3CD] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#BCBBB5]"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#BCBBB5]"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#BCBBB5]"></span>
                <span className="ml-2 text-xs font-mono text-[#555555] font-semibold">
                  routeco2-dispatcher-daemon · session-arc-5042002
                </span>
              </div>
              <div className="text-xs font-mono text-[#111111] font-bold">{zuluTime}</div>
            </div>

            {/* Flight Scenario Selector Bar */}
            <div className="p-4 bg-[#ECEBE6] border-b border-[#D4D3CD] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#555555] font-bold uppercase">
                  SELECT AIRFRAME TARGET:
                </span>
                <div className="flex items-center gap-1.5">
                  {DEMO_FLIGHTS.map((flight, idx) => {
                    const isSelected = selectedScenarioIdx === idx;
                    return (
                      <button
                        key={flight.callsign}
                        type="button"
                        onClick={() => {
                          if (!cycleRunning) {
                            setSelectedScenarioIdx(idx);
                            handleReset();
                          }
                        }}
                        disabled={cycleRunning}
                        className={`btn-pill px-3 py-1 text-xs font-mono font-bold transition-all cursor-pointer active:scale-[0.97] ${
                          isSelected
                            ? "bg-[#111111] text-white"
                            : "bg-[#D6D5CF] text-[#555555] hover:text-[#111111] border border-[#D4D3CD]"
                        }`}
                      >
                        {flight.callsign} · {flight.airframeCode}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-xs font-mono text-[#555555]">
                <span>CORRIDOR: </span>
                <span className="text-[#111111] font-bold">
                  {currentScenario.origin} → {currentScenario.destination}
                </span>
              </div>
            </div>

            {/* Split Console Grid */}
            <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Step List & Actions */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                <div>
                  <div className="text-xs font-mono text-[#555555] uppercase tracking-wider font-bold mb-4">
                    DISPATCH LIFECYCLE STAGES:
                  </div>

                  <ol className="space-y-2.5">
                    {[
                      { idx: "01", name: "DETECT", desc: "OpenSky ADS-B State Vector" },
                      { idx: "02", name: "MEASURE", desc: "ICAO Doc 9889 Fuel Kinematics" },
                      { idx: "03", name: "QUOTE", desc: "1inch Aqua Dynamic SwapVM Route" },
                      { idx: "04", name: "SIGN", desc: "Circle Agent Scoped Wallet" },
                      { idx: "05", name: "SETTLE", desc: "Arc Testnet Sub-Second Finality" },
                      { idx: "06", name: "RETIRE", desc: "On-Chain Certificate Burned" },
                    ].map((step, i) => {
                      const isDone = currentStep > i;
                      const isCurrent = currentStep === i;
                      return (
                        <li
                          key={step.idx}
                          className={`p-3 rounded-lg border text-xs font-mono flex items-center gap-3 transition-all duration-200 ${
                            isCurrent
                              ? "bg-[#ECEBE6] border-[#FF4D00] text-[#FF4D00] shadow-sm translate-x-1"
                              : isDone
                              ? "bg-[#ECEBE6] border-[#3ECF8E] text-[#15803D]"
                              : "bg-[#ECEBE6] border-[#D4D3CD] text-[#555555]"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] border border-current shrink-0 transition-transform ${
                              isCurrent ? "scale-110" : "scale-100"
                            }`}
                          >
                            {isDone ? "✓" : step.idx}
                          </span>
                          <div>
                            <div className="font-bold">{step.name}</div>
                            <div className="text-[10.5px] opacity-80">{step.desc}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {/* Controls & Metrics */}
                <div className="space-y-4 pt-4 border-t border-[#D4D3CD]">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={runSimulationCycle}
                      disabled={cycleRunning}
                      className={`flex-1 py-2.5 px-4 rounded-md text-xs font-mono font-bold transition-all ${
                        cycleRunning
                          ? "bg-[#BCBBB5] text-[#555555] cursor-not-allowed"
                          : "bg-[#111111] hover:bg-[#FF4D00] text-white active:scale-[0.97] cursor-pointer"
                      }`}
                    >
                      {cycleRunning ? "DISPATCHING IN PROGRESS..." : "EXECUTE DISPATCH CYCLE"}
                    </button>

                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={cycleRunning}
                      className="py-2.5 px-4 rounded-md text-xs font-mono font-bold border border-[#D4D3CD] bg-[#ECEBE6] text-[#111111] hover:bg-[#D6D5CF] active:scale-[0.97] transition-all cursor-pointer"
                    >
                      CLEAR
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="p-2.5 rounded-lg border border-[#D4D3CD] bg-[#ECEBE6]">
                      <div className="text-[#555555] text-[10px] uppercase font-bold">CYCLES</div>
                      <div
                        key={`cycles-${stats.cycles}`}
                        className={`text-sm font-bold text-[#111111] mt-0.5 ${
                          stats.cycles > 0 ? "animate-counter-bump" : ""
                        }`}
                      >
                        {stats.cycles}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-[#D4D3CD] bg-[#ECEBE6]">
                      <div className="text-[#555555] text-[10px] uppercase font-bold">RETIRED</div>
                      <div
                        key={`co2-${stats.cycles}`}
                        className={`text-sm font-bold text-[#3ECF8E] mt-0.5 ${
                          stats.cycles > 0 ? "animate-counter-bump" : ""
                        }`}
                      >
                        {stats.co2.toFixed(1)} T
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-[#D4D3CD] bg-[#ECEBE6]">
                      <div className="text-[#555555] text-[10px] uppercase font-bold">SETTLED</div>
                      <div
                        key={`usdc-${stats.cycles}`}
                        className={`text-sm font-bold text-[#111111] mt-0.5 ${
                          stats.cycles > 0 ? "animate-counter-bump" : ""
                        }`}
                      >
                        ${stats.usdc.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Cockpit Terminal HUD & Receipt */}
              <div className="lg:col-span-7 flex flex-col h-[500px]">
                <div
                  ref={terminalContainerRef}
                  className="flex-1 rounded-lg border border-[#D4D3CD] bg-[#111111] text-[#ECEBE6] p-4 font-mono text-xs overflow-y-auto flex flex-col justify-between shadow-inner"
                >
                  <div className="space-y-2">
                    <div className="text-[#888888] pb-2 border-b border-[#2A2A2A] flex justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#FF4D00] animate-pulse"></span>
                        RADAR AVIONICS TERMINAL
                      </span>
                      <span>ARC L1: 5042002</span>
                    </div>

                    {consoleLogs.length === 0 ? (
                      <div className="py-20 text-center text-[#555555]">
                        Press &quot;EXECUTE DISPATCH CYCLE&quot; to initialize radar contact...
                      </div>
                    ) : (
                      consoleLogs.map((log, idx) => (
                        <div key={idx} className="leading-relaxed flex items-start gap-2 animate-stream-line">
                          <span className="text-[#FF4D00] select-none font-bold">&gt;</span>
                          <span className="flex-1 text-[#D4D2CA]">{log.text}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Flight Telemetry Strip */}
                  <div className="mt-4 pt-3 border-t border-[#2A2A2A] grid grid-cols-4 gap-2 text-[10px] text-[#888888]">
                    <div>
                      <span>CALLSIGN: </span>
                      <b className="text-[#ECEBE6]">{currentScenario.callsign}</b>
                    </div>
                    <div>
                      <span>TYPE: </span>
                      <b className="text-[#ECEBE6]">{currentScenario.airframeCode}</b>
                    </div>
                    <div>
                      <span>CRUISE: </span>
                      <b className="text-[#ECEBE6]">FL{currentScenario.altitudeFl}</b>
                    </div>
                    <div>
                      <span>BURN: </span>
                      <b className="text-[#ECEBE6]">{currentScenario.burnRateKgS} KG/S</b>
                    </div>
                  </div>
                </div>

                {/* Settlement Receipt Card */}
                {receipt && (
                  <div className="mt-4 p-4 rounded-lg border border-[#3ECF8E] bg-[#ECEBE6] text-[#111111] font-mono text-xs animate-receipt-pop">
                    <div className="flex items-center justify-between pb-2 border-b border-[#D4D3CD]">
                      <span className="font-bold flex items-center gap-1.5 text-[#15803D]">
                        <span>✓</span> SETTLEMENT FINALIZED ON ARC TESTNET
                      </span>
                      <a
                        href="https://testnet.arcscan.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FF4D00] font-bold underline hover:opacity-80"
                      >
                        ARCSCAN EXPLORER ↗
                      </a>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[#555555]">TX HASH: </span>
                        <span className="text-[#111111] font-bold">{receipt.txHash}</span>
                      </div>
                      <div>
                        <span className="text-[#555555]">BLOCK: </span>
                        <span className="text-[#111111] font-bold">{receipt.blockNumber}</span>
                      </div>
                      <div>
                        <span className="text-[#555555]">AMOUNT: </span>
                        <span className="text-[#111111] font-bold">{receipt.usdcAmount}</span>
                      </div>
                      <div>
                        <span className="text-[#555555]">FINALITY: </span>
                        <span className="text-[#FF4D00] font-bold">{receipt.finalityMs} ms</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[#555555]">CERTIFICATE: </span>
                        <span className="text-[#111111] font-bold">
                          {receipt.certificateId} · {receipt.co2Retired} ({receipt.creditType})
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SEC 05 : OPEN SOURCE ARCHITECTURE ================= */}
      <section id="source" className="py-20 md:py-28 border-b border-[#D4D3CD]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="scroll-entry">
            <span className="btn-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-wider mb-4 bg-[#D6D5CF] border border-[#D4D3CD] text-[#111111]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D00]"></span>
              OPEN PROTOCOL
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111111]">
              Every component in the loop is open.
            </h2>
            <p className="text-[#555555] text-base md:text-lg max-w-2xl mt-4 leading-relaxed">
              Clone the repository, connect your testnet credentials, and monitor your own flight corridors. One
              transparent module per pipeline stage: nothing hidden behind a closed service.
            </p>
          </div>

          {/* Files Grid */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
            {CODE_FILES.map((f) => (
              <a
                key={f.path}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="scroll-entry card-tactile p-4 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF] flex items-center justify-between group hover:border-[#111111]"
              >
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="btn-pill px-1.5 py-0.2 text-[9px] font-mono uppercase tracking-wider font-bold"
                      style={{ backgroundColor: f.bg, color: f.color }}
                    >
                      {f.tag}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#111111] truncate">
                      {f.path}
                    </span>
                  </div>
                  <p className="text-xs text-[#555555] truncate">{f.desc}</p>
                </div>
                <span className="font-mono text-xs font-bold text-[#555555] group-hover:text-[#FF4D00] shrink-0 transition-colors">
                  {f.lang} ↗
                </span>
              </a>
            ))}
          </div>

          {/* Quick Clone Bar */}
          <div className="scroll-entry mt-8 p-6 rounded-xl border border-[#D4D3CD] bg-[#D6D5CF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-[#555555] uppercase tracking-wider font-bold">
                DEVELOPER QUICKSTART:
              </div>
              <div className="mt-1 font-mono text-sm text-[#111111]">
                <kbd className="px-2.5 py-1 rounded bg-[#ECEBE6] border border-[#D4D3CD] font-mono text-xs font-semibold">
                  git clone https://github.com/anynomousfriend/RouteCO2.git
                </kbd>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopyClone}
                className="btn-pill px-4 py-2 border border-[#D4D3CD] bg-[#ECEBE6] text-[#111111] text-xs font-mono font-bold hover:bg-[#D6D5CF] active:scale-[0.97] transition-all cursor-pointer"
              >
                {copied ? "COPIED TO CLIPBOARD" : "COPY COMMAND"}
              </button>

              <a
                href="https://github.com/anynomousfriend/RouteCO2"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-pill px-4 py-2 bg-[#111111] hover:bg-[#FF4D00] text-white text-xs font-mono font-bold active:scale-[0.97] transition-all cursor-pointer"
              >
                GITHUB REPO ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SEC 06 : FAQ ACCORDION ================= */}
      <section id="faq" className="py-20 md:py-28 border-b border-[#D4D3CD] bg-[#DFDED9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="scroll-entry">
            <span className="btn-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-wider mb-4 bg-[#D6D5CF] border border-[#D4D3CD] text-[#FF4D00]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D00]"></span>
              TECHNICAL FAQ
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111111]">
              Frequently asked questions.
            </h2>
            <p className="text-[#555555] text-base md:text-lg max-w-2xl mt-4 leading-relaxed">
              Addressing architecture design, telemetry verification, and live testnet clearing mechanics.
            </p>
          </div>

          {/* Minimalist Container-Free Accordion with Putty Separators */}
          <div className="mt-12 divide-y divide-[#D4D3CD] border-t border-[#D4D3CD]">
            {FAQS.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div key={idx} className="scroll-entry py-6">
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full text-left flex items-start justify-between gap-4 group cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <span className="text-lg sm:text-xl font-bold text-[#111111] group-hover:text-[#FF4D00] transition-colors">
                      {faq.question}
                    </span>
                    <span
                      className="font-mono text-xl text-[#555555] group-hover:text-[#FF4D00] shrink-0 font-bold inline-block"
                      style={{
                        transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                        transition: "transform 200ms var(--ease-out), color 150ms ease",
                      }}
                    >
                      +
                    </span>
                  </button>

                  <div className={`accordion-grid ${isOpen ? "open" : ""}`}>
                    <div className="accordion-inner text-xs text-[#555555] font-sans leading-relaxed max-w-3xl pr-8 pt-3">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= EDITORIAL COCKPIT FOOTER ================= */}
      <footer className="py-16 bg-[#ECEBE6]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-12 border-b border-[#D4D3CD]">
            <div>
              <div className="flex items-center gap-2.5 text-sm font-bold text-[#111111]">
                <RouteCo2Logo className="w-6 h-6" />
                <span className="font-mono tracking-wider text-xs">ROUTECO2</span>
              </div>
              <p className="text-xs text-[#555555] mt-2 max-w-sm font-mono">
                Autonomous in-flight carbon settlement protocol. Sense, measure, settle on a continuous ten-second
                loop.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-[#555555]">
              <div>
                <span>COORDINATES: </span>
                <span className="text-[#111111] font-bold">EDDF · 50.0379°N 8.5622°E</span>
              </div>
              <div>
                <span>ZULU: </span>
                <span className="text-[#111111] font-bold">{zuluTime}</span>
              </div>
              <div>
                <span>LEDGER: </span>
                <a
                  href="https://testnet.arcscan.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FF4D00] font-bold hover:underline"
                >
                  ARC TESTNET ↗
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-[#555555]">
            <p>
              Telemetry on this page is simulated for demonstration; production builds consume live OpenSky ADS-B feeds.
            </p>
            <div className="shrink-0 text-[#111111] font-bold">
              ROUTECO2 · ZERO CUSTODY · ZERO PAPER
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
