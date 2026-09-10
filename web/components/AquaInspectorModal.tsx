"use client";

import React, { useEffect } from "react";
import { X, Layers, ExternalLink, ShieldCheck, CheckCircle2, Lock, ArrowUpRight, Cpu } from "lucide-react";
import { AquaFlowVisualizer } from "./AquaFlowVisualizer";

interface AquaInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLanded: boolean;
  isSettled: boolean;
  isSettling: boolean;
  usdcAmount: number;
  co2Kg: number;
  vaultAddress?: string;
  aquaAddress?: string;
}

export function AquaInspectorModal({
  isOpen,
  onClose,
  isLanded,
  isSettled,
  isSettling,
  usdcAmount,
  co2Kg,
  vaultAddress = "0xe6bbB15BA58E46Cd02Cfa4B842A9e3Dc3a66b57F",
  aquaAddress = "0xE3Ec9dEb24fF3AD05cF0324b77DA128078780535",
}: AquaInspectorModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aqua-modal-title"
        className="relative w-full max-w-2xl bg-[#272e33] shadow-2xl border border-dashed border-[#d3c6aa]/20 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dashed border-[#d3c6aa]/16 flex items-center justify-between bg-[#1e2528]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#7fbbb3] flex items-center justify-center text-[#2d353b]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 id="aqua-modal-title" className="text-sm font-bold text-[#d3c6aa] font-mono flex items-center gap-2">
                <span>1INCH AQUA ZERO-CUSTODY SHARED TVU</span>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-[#7fbbb3]/15 text-[#7fbbb3] border border-dashed border-[#7fbbb3]/40 font-semibold">
                  Track 1
                </span>
              </h2>
              <p className="text-[11px] text-[#859289] font-mono">
                Zero escrow float: treasury USDC remains in corporate self-custody until touchdown fill
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 bg-[#d3c6aa]/10 hover:bg-[#d3c6aa]/20 flex items-center justify-center text-[#859289] hover:text-[#d3c6aa] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5 text-[#9daaa4] font-mono">
          {/* Visual Architecture Flow */}
          <AquaFlowVisualizer
            isLanded={isLanded}
            isSettled={isSettled}
            isSettling={isSettling}
            usdcAmount={usdcAmount}
            co2Kg={co2Kg}
          />

          {/* Key Architectural Principles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#d3c6aa] font-mono">
                <Lock className="w-3.5 h-3.5 text-[#a7c080]" />
                <span>Zero Custodial Lockup (TVU)</span>
              </div>
              <p className="text-[11px] text-[#859289] leading-relaxed font-mono">
                Airlines retain 100% control of their treasury USDC balance. No upfront escrow deposit is required. Liquidity is virtually quoted across flight legs via <code className="text-[11px] bg-[#d3c6aa]/10 px-1 py-0.5 font-mono text-[#7fbbb3]">aqua.ship()</code>.
              </p>
            </div>

            <div className="p-3.5 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#d3c6aa] font-mono">
                <Cpu className="w-3.5 h-3.5 text-[#dbbc7f]" />
                <span>SwapVM Fuel-Efficiency Curves</span>
              </div>
              <p className="text-[11px] text-[#859289] leading-relaxed font-mono">
                Dynamic cruise discounts and climb-rate adjustments are compiled into SwapVM bytecode instructions (<code className="text-[11px] bg-[#d3c6aa]/10 px-1 py-0.5 font-mono text-[#7fbbb3]">_piecewiseLinearScale</code>, <code className="text-[11px] bg-[#d3c6aa]/10 px-1 py-0.5 font-mono text-[#7fbbb3]">_decayXD</code>).
              </p>
            </div>
          </div>

          {/* On-Chain Verified Contracts */}
          <div className="p-4 bg-[#1e2528] text-[#d3c6aa] border border-dashed border-[#d3c6aa]/16 flex flex-col gap-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#859289] font-semibold">
              Live Verified Protocol Deployments (Arc Testnet · 5042002)
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 bg-[#2d353b] border border-dashed border-[#d3c6aa]/[0.08]">
                <div className="flex flex-col">
                  <span className="text-[#859289] text-[10px]">SkyRouteVault (Custom Aqua App)</span>
                  <span className="text-[#d3c6aa] font-semibold">{vaultAddress}</span>
                </div>
                <a
                  href={`https://testnet.arcscan.app/address/${vaultAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-[#a7c080]/20 text-[#a7c080] hover:bg-[#a7c080]/30 flex items-center gap-1 text-[11px] transition-colors"
                >
                  <span>ArcScan</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center justify-between p-2 bg-[#2d353b] border border-dashed border-[#d3c6aa]/[0.08]">
                <div className="flex flex-col">
                  <span className="text-[#859289] text-[10px]">AquaCore Shared Liquidity Registry</span>
                  <span className="text-[#d3c6aa] font-semibold">{aquaAddress}</span>
                </div>
                <a
                  href={`https://testnet.arcscan.app/address/${aquaAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-[#7fbbb3]/20 text-[#7fbbb3] hover:bg-[#7fbbb3]/30 flex items-center gap-1 text-[11px] transition-colors"
                >
                  <span>ArcScan</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-dashed border-[#d3c6aa]/16 bg-[#1e2528]/60 flex justify-between items-center text-xs text-[#859289] font-mono">
          <span>ETHOnline 2026 · RouteCO2 Protocol</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#d3c6aa] text-[#2d353b] hover:bg-[#dbbc7f] text-xs font-semibold transition-[transform,colors] duration-140 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
