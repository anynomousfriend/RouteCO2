"use client";

import React from "react";
import {
  X,
  ExternalLink,
  Printer,
  CheckCircle2,
  ShieldCheck,
  Plane,
  Clock,
  Fuel,
  Leaf,
  Layers,
  Zap,
} from "lucide-react";

export interface SettlementCertificateData {
  flightId: string;
  callsign: string;
  airline: string;
  airframe: string;
  originAirport: string;
  destinationAirport: string;
  destinationName: string;
  runway: string;
  icao24: string;
  airborneSeconds: number;
  fuelBurnKg: number;
  co2Kg: number;
  costUSDC: number;
  blockNumber: number;
  txHash: string;
  explorerUrl: string;
  agentAddress: string;
  vaultAddress: string;
  timestamp: number;
}

interface SettlementCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SettlementCertificateData | null;
}

export function SettlementCertificateModal({
  isOpen,
  onClose,
  data,
}: SettlementCertificateModalProps) {
  if (!isOpen || !data) return null;

  const hours = (data.airborneSeconds / 3600).toFixed(2);
  const co2Tonnes = (data.co2Kg / 1000).toFixed(3);
  const formattedDate = new Date(data.timestamp).toUTCString();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="settlement-certificate-modal"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="settlement-certificate-card"
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-black/10 flex flex-col custom-scrollbar animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-xs border-b border-black/5 no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold text-sm">
              R
            </div>
            <div>
              <div className="text-xs font-mono font-bold tracking-wider text-black">
                ROUTECO2 // FLIGHT OPERATIONS
              </div>
              <div className="text-[10px] text-[#666666]">
                ICAO Doc 9889 Verified Carbon Reconciliation
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              title="Print Operations Receipt"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg cursor-pointer btn-tactile transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-black rounded-lg hover:bg-neutral-100 cursor-pointer btn-tactile transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Body */}
        <div className="p-6 space-y-5">
          {/* Certificate Title Banner */}
          <div className="text-center py-2 border-b border-black/5">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 mb-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-mono font-semibold">
              <CheckCircle2 className="w-3 h-3" />
              <span>WHEELS-DOWN ON-CHAIN SETTLEMENT VERIFIED</span>
            </div>
            <h2 className="font-serif text-2xl font-normal text-black tracking-tight">
              Executive Carbon Reconciliation Certificate
            </h2>
            <p className="text-xs text-[#666666] max-w-md mx-auto mt-1">
              Automated zero-custody micro-settlement executed on Arc Testnet via 1inch Aqua.
            </p>
          </div>

          {/* Flight Manifest Grid */}
          <div className="bg-neutral-50 rounded-xl p-4 border border-black/5">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#666666] mb-3 flex items-center justify-between">
              <span>Flight Manifest & Telemetry</span>
              <span className="text-neutral-400">ICAO Hex: 0x{data.icao24.toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-[10px] text-[#666666]">Callsign</div>
                <div className="font-mono font-bold text-sm text-black">{data.callsign}</div>
                <div className="text-[10px] text-neutral-500">{data.airline}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#666666]">Airframe</div>
                <div className="font-semibold text-black">{data.airframe}</div>
                <div className="text-[10px] text-neutral-500 font-mono">Runway {data.runway}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#666666]">Route</div>
                <div className="font-mono font-bold text-black">
                  {data.originAirport} → {data.destinationAirport}
                </div>
                <div className="text-[10px] text-neutral-500 truncate">{data.destinationName}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#666666]">Airborne Time</div>
                <div className="font-mono font-bold text-black">{data.airborneSeconds}s</div>
                <div className="text-[10px] text-neutral-500">{hours} flight hours</div>
              </div>
            </div>
          </div>

          {/* Environmental Ledger & Math */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-3 border border-black/5 shadow-xs">
              <div className="flex items-center gap-1.5 text-[10px] text-[#666666] font-mono mb-1">
                <Fuel className="w-3.5 h-3.5 text-amber-500" />
                <span>Jet-A1 Fuel Burn</span>
              </div>
              <div className="font-mono text-lg font-bold text-black">
                {data.fuelBurnKg.toLocaleString()} <span className="text-xs font-normal">kg</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">ICAO Category Benchmark</div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-black/5 shadow-xs">
              <div className="flex items-center gap-1.5 text-[10px] text-[#666666] font-mono mb-1">
                <Leaf className="w-3.5 h-3.5 text-emerald-500" />
                <span>Verified CO₂</span>
              </div>
              <div className="font-mono text-lg font-bold text-emerald-600">
                {co2Tonnes} <span className="text-xs font-normal">tonnes</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">CORSIA Factor: 3.16x</div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-black/5 shadow-xs">
              <div className="flex items-center gap-1.5 text-[10px] text-[#666666] font-mono mb-1">
                <Zap className="w-3.5 h-3.5 text-[#007AFF]" />
                <span>Arc Settlement</span>
              </div>
              <div className="font-mono text-lg font-bold text-[#007AFF]">
                ${data.costUSDC.toFixed(2)} <span className="text-xs font-normal">USDC</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">@ $25.00 / tonne</div>
            </div>
          </div>

          {/* On-Chain ArcScan Cryptographic Receipt */}
          <div className="bg-neutral-900 text-white rounded-xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-neutral-400 border-b border-neutral-800 pb-2">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                ARC L1 CRYPTOGRAPHIC PROOF
              </span>
              <span>Block #{data.blockNumber}</span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Transaction Hash:</span>
                <a
                  href={data.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <span>{data.txHash.slice(0, 16)}...{data.txHash.slice(-10)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">1inch Aqua App Vault:</span>
                <span className="text-neutral-200">{data.vaultAddress.slice(0, 12)}...{data.vaultAddress.slice(-8)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Circle Agent Signer:</span>
                <span className="text-neutral-200">{data.agentAddress.slice(0, 12)}...{data.agentAddress.slice(-8)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Network Finality:</span>
                <span className="text-emerald-400 font-bold">Sub-second (&lt; 800ms)</span>
              </div>
            </div>
          </div>

          {/* Enterprise Step-Cutting Comparison Card */}
          <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200/60">
            <div className="text-[11px] font-mono font-bold text-emerald-900 mb-2">
              ENTERPRISE EFFICIENCY: MANUAL AUDIT VS. ROUTECO2
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1 text-neutral-600 border-r border-emerald-200/50 pr-2">
                <div className="font-semibold text-neutral-800">Traditional Process</div>
                <div className="text-[11px]">• 45–90 days manual auditing lag</div>
                <div className="text-[11px]">• $1,200+ third-party certifier fee</div>
                <div className="text-[11px]">• Capital trapped in broker escrow float</div>
                <div className="text-[11px]">• Zero flight-level proof of provenance</div>
              </div>
              <div className="space-y-1 text-emerald-800 font-medium">
                <div className="font-bold text-emerald-900">RouteCO2 Protocol</div>
                <div className="text-[11px]">• 1 block (&lt;1s) autonomous settlement</div>
                <div className="text-[11px]">• $0.0001 gas cost (native USDC)</div>
                <div className="text-[11px]">• 0% escrow lockup (1inch Aqua)</div>
                <div className="text-[11px]">• Permanent, verifiable on-chain receipt</div>
              </div>
            </div>
          </div>

          {/* Footer Timestamp */}
          <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-2 border-t border-black/5 font-mono">
            <span>Reconciliation Timestamp: {formattedDate}</span>
            <span>RouteCO2 Protocol v1.0 (ETHOnline 2026)</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 px-6 py-3 bg-white/95 backdrop-blur-xs border-t border-black/5 no-print">
          <a
            href={data.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg cursor-pointer btn-tactile transition-colors"
          >
            <span>Inspect on ArcScan</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          body > *:not(#settlement-certificate-modal) {
            display: none !important;
          }
          #settlement-certificate-modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            display: block !important;
          }
          #settlement-certificate-card {
            max-height: none !important;
            box-shadow: none !important;
            border: 1px solid #e5e5e5 !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
