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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aqua-modal-title"
        className="relative w-full max-w-2xl bg-[#ECEBE6] text-[#111111] rounded-xl shadow-2xl border border-[#D4D3CD] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#D4D3CD] flex items-center justify-between bg-[#D6D5CF]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#111111] flex items-center justify-center text-[#ECEBE6]">
              <Layers className="w-4 h-4 text-[#FF4D00]" />
            </div>
            <div>
              <h2 id="aqua-modal-title" className="text-sm font-bold text-[#111111] font-sans flex items-center gap-2">
                <span>1INCH AQUA ZERO-CUSTODY SHARED TVU</span>
                <span className="btn-pill px-2.5 py-0.5 text-[10px] font-mono bg-[#ECEBE6] text-[#FF4D00] border border-[#D4D3CD] font-semibold">
                  Track 1
                </span>
              </h2>
              <p className="text-[11px] text-[#555555] font-sans">
                Zero escrow float: treasury USDC remains in corporate self-custody until touchdown fill
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="icon-circle w-8 h-8 text-[#555555] hover:text-[#111111] hover:bg-[#ECEBE6] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5 text-[#111111] font-sans">
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
            <div className="p-4 rounded-xl bg-[#D6D5CF] border border-[#D4D3CD] flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111111]">
                <Lock className="w-3.5 h-3.5 text-[#FF4D00]" />
                <span>Zero Custodial Lockup (TVU)</span>
              </div>
              <p className="text-[11px] text-[#555555] leading-relaxed">
                Airlines retain 100% control of their treasury USDC balance. No upfront escrow deposit is required. Liquidity is virtually quoted across flight legs via <code className="text-[11px] bg-[#ECEBE6] px-1.5 py-0.5 rounded font-mono text-[#111111] border border-[#D4D3CD]">aqua.ship()</code>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#D6D5CF] border border-[#D4D3CD] flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111111]">
                <Cpu className="w-3.5 h-3.5 text-[#FF4D00]" />
                <span>SwapVM Fuel-Efficiency Curves</span>
              </div>
              <p className="text-[11px] text-[#555555] leading-relaxed">
                Dynamic cruise discounts and climb-rate adjustments are compiled into SwapVM bytecode instructions (<code className="text-[11px] bg-[#ECEBE6] px-1.5 py-0.5 rounded font-mono text-[#111111] border border-[#D4D3CD]">_piecewiseLinearScale</code>, <code className="text-[11px] bg-[#ECEBE6] px-1.5 py-0.5 rounded font-mono text-[#111111] border border-[#D4D3CD]">_decayXD</code>).
              </p>
            </div>
          </div>

          {/* On-Chain Verified Contracts */}
          <div className="p-4 rounded-xl bg-[#D6D5CF] text-[#111111] border border-[#D4D3CD] flex flex-col gap-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#555555] font-semibold">
              Live Verified Protocol Deployments (Arc Testnet · 5042002)
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#ECEBE6] border border-[#D4D3CD]">
                <div className="flex flex-col">
                  <span className="text-[#555555] text-[10px] font-sans">SkyRouteVault (Custom Aqua App)</span>
                  <span className="text-[#111111] font-semibold">{vaultAddress}</span>
                </div>
                <a
                  href={`https://testnet.arcscan.app/address/${vaultAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-pill px-3 py-1 bg-[#111111] text-[#ECEBE6] hover:bg-[#FF4D00] flex items-center gap-1 text-[11px] font-sans transition-colors"
                >
                  <span>ArcScan</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[#ECEBE6] border border-[#D4D3CD]">
                <div className="flex flex-col">
                  <span className="text-[#555555] text-[10px] font-sans">AquaCore Shared Liquidity Registry</span>
                  <span className="text-[#111111] font-semibold">{aquaAddress}</span>
                </div>
                <a
                  href={`https://testnet.arcscan.app/address/${aquaAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-pill px-3 py-1 bg-[#111111] text-[#ECEBE6] hover:bg-[#FF4D00] flex items-center gap-1 text-[11px] font-sans transition-colors"
                >
                  <span>ArcScan</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#D4D3CD] bg-[#D6D5CF]/60 flex justify-between items-center text-xs text-[#555555] font-sans">
          <span>ETHOnline 2026 · RouteCO2 Protocol</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-pill px-4 py-1.5 bg-[#111111] text-[#ECEBE6] hover:bg-[#FF4D00] text-xs font-semibold transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
