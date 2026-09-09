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
  vaultAddress = "0xb579e26C81FDf858a9A6a0F3CcAB497a70343c5d",
  aquaAddress = "0xdF020AedA9726EE4085cbD611AdeC830C6569464",
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
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-black/10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.08] flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center text-white">
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 id="aqua-modal-title" className="text-sm font-bold text-black font-sans flex items-center gap-2">
                <span>1inch Aqua Zero-Custody Shared TVU</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                  Track 1
                </span>
              </h2>
              <p className="text-[11px] text-neutral-500 font-sans">
                Zero escrow float: treasury USDC remains in corporate self-custody until touchdown fill
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full bg-neutral-200/80 hover:bg-neutral-300/80 flex items-center justify-center text-neutral-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5 text-neutral-800">
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
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-black/[0.06] flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-black">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero Custodial Lockup (TVU)</span>
              </div>
              <p className="text-[11px] text-neutral-600 leading-relaxed font-sans">
                Airlines retain 100% control of their treasury USDC balance. No upfront escrow deposit is required. Liquidity is virtually quoted across flight legs via <code className="text-xs bg-neutral-200/70 px-1 py-0.5 rounded font-mono">aqua.ship()</code>.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-black/[0.06] flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-black">
                <Cpu className="w-3.5 h-3.5 text-[#7C4DFF]" />
                <span>SwapVM Fuel-Efficiency Curves</span>
              </div>
              <p className="text-[11px] text-neutral-600 leading-relaxed font-sans">
                Dynamic cruise discounts and climb-rate adjustments are compiled into SwapVM bytecode instructions (<code className="text-xs bg-neutral-200/70 px-1 py-0.5 rounded font-mono">_piecewiseLinearScale</code>, <code className="text-xs bg-neutral-200/70 px-1 py-0.5 rounded font-mono">_decayXD</code>).
              </p>
            </div>
          </div>

          {/* On-Chain Verified Contracts */}
          <div className="p-4 rounded-2xl bg-[#0F1420] text-white border border-white/10 flex flex-col gap-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              Live Verified Protocol Deployments (Arc Testnet · 5042002)
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                <div className="flex flex-col">
                  <span className="text-neutral-400 text-[10px]">SkyRouteVault (Custom Aqua App)</span>
                  <span className="text-white font-semibold">{vaultAddress}</span>
                </div>
                <a
                  href={`https://testnet.arcscan.app/address/${vaultAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 flex items-center gap-1 text-[11px] transition-colors"
                >
                  <span>ArcScan</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                <div className="flex flex-col">
                  <span className="text-neutral-400 text-[10px]">AquaCore Shared Liquidity Registry</span>
                  <span className="text-white font-semibold">{aquaAddress}</span>
                </div>
                <a
                  href={`https://testnet.arcscan.app/address/${aquaAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 flex items-center gap-1 text-[11px] transition-colors"
                >
                  <span>ArcScan</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-black/[0.08] bg-neutral-50/50 flex justify-between items-center text-xs text-neutral-500 font-sans">
          <span>ETHOnline 2026 · RouteCO2 Protocol</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-black text-white hover:bg-neutral-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
