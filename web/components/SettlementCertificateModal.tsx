"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ExternalLink,
  Printer,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Check,
  Cpu,
  Fuel,
  Leaf,
  Zap,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Terminal,
  Activity,
} from "lucide-react";
import { RouteCo2Logo } from "./RouteCo2Logo";

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
  scaledCostUSDC?: string;
  totalCarbonOffsetKg?: string;
  blockNumber?: number;
  txHash?: string;
  explorerUrl?: string;
  agentAddress: string;
  vaultAddress: string;
  timestamp: number;
}

interface SettlementCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SettlementCertificateData | null;
}

export interface LiveReceiptData {
  success: boolean;
  confirmedOnL1: boolean;
  status: string;
  blockNumber: number;
  currentL1Block: number | null;
  confirmations: number;
  gasUsed: string;
  from: string;
  to: string;
  txHash: string;
  nodeUrl: string;
  isIndexedOnArcScan: boolean;
  arcScanBlockLag: number | null;
  rawReceipt: Record<string, unknown>;
}

export function SettlementCertificateModal({
  isOpen,
  onClose,
  data,
}: SettlementCertificateModalProps) {
  const [copiedTx, setCopiedTx] = useState(false);
  const [showRawReceipt, setShowRawReceipt] = useState(false);
  const [receiptState, setReceiptState] = useState<{
    isLoading: boolean;
    data: LiveReceiptData | null;
    error: string | null;
  }>({ isLoading: false, data: null, error: null });

  const fetchLiveReceipt = async (txHash: string) => {
    setReceiptState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/receipt?txHash=${txHash}`);
      if (!res.ok) {
        throw new Error("Unable to reach Arc L1 RPC node");
      }
      const json = await res.json();
      setReceiptState({ isLoading: false, data: json, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Live RPC query failed";
      setReceiptState({ isLoading: false, data: null, error: msg });
    }
  };

  useEffect(() => {
    if (isOpen && data?.txHash) {
      fetchLiveReceipt(data.txHash);
    } else {
      setReceiptState({ isLoading: false, data: null, error: null });
      setShowRawReceipt(false);
    }
  }, [isOpen, data?.txHash]);

  // Keyboard Escape & Background Scroll Lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const hours = (data.airborneSeconds / 3600).toFixed(2);
  const co2Tonnes = (data.co2Kg / 1000).toFixed(3);
  const formattedDate = new Date(data.timestamp).toUTCString();

  const handlePrint = () => {
    window.print();
  };

  const handleCopyTx = () => {
    if (data?.txHash) {
      navigator.clipboard.writeText(data.txHash);
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 2000);
    }
  };

  return (
    <div
      id="settlement-certificate-modal"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-160"
      onClick={onClose}
    >
      <div
        id="settlement-certificate-card"
        style={{
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-black/[0.08] flex flex-col custom-scrollbar animate-in zoom-in-95 duration-180 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-md border-b border-black/[0.06] no-print">
          <div className="flex items-center gap-2.5">
            <RouteCo2Logo className="w-8 h-8 rounded-xl shadow-xs border border-black/10 shrink-0" />
            <div>
              <div className="text-xs font-mono font-bold tracking-wider text-black">
                ROUTECO2 // FLIGHT OPERATIONS
              </div>
              <div className="text-[10px] text-neutral-500">
                ICAO Doc 9889 Verified Carbon Reconciliation
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              title="Print Operations Receipt (Cmd+P)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer active:scale-[0.96] transition-[transform,colors] duration-140"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 text-neutral-400 hover:text-black rounded-xl hover:bg-neutral-100 cursor-pointer active:scale-[0.92] transition-[transform,colors] duration-140"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Certificate Body */}
        <div className="p-6 space-y-5">
          {/* Certificate Title Banner */}
          <div className="text-center py-2 border-b border-black/[0.06]">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>WHEELS-DOWN ON-CHAIN RECONCILIATION VERIFIED</span>
            </div>
            <h2 className="font-serif text-2xl font-normal text-black tracking-tight">
              Executive Carbon Reconciliation Certificate
            </h2>
            <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1 font-sans">
              Automated zero-custody settlement executed on Arc Testnet via 1inch Aqua.
            </p>
          </div>

          {/* Flight Manifest & Telemetry Table */}
          <div className="bg-neutral-50 rounded-2xl p-4 border border-black/[0.06]">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500 mb-3 flex items-center justify-between">
              <span>Flight Manifest & Telemetry</span>
              <span className="text-neutral-400">ICAO Transponder: 0x{data.icao24.toUpperCase().replace("0X", "")}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-[10px] text-neutral-500">Callsign</div>
                <div className="font-mono font-bold text-sm text-black tabular-nums">{data.callsign}</div>
                <div className="text-[10px] text-neutral-500">{data.airline}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500">Airframe</div>
                <div className="font-semibold text-black">{data.airframe}</div>
                <div className="text-[10px] text-neutral-500 font-mono">Runway {data.runway}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500">Route</div>
                <div className="font-mono font-bold text-black">
                  {data.originAirport} → {data.destinationAirport}
                </div>
                <div className="text-[10px] text-neutral-500 truncate">{data.destinationName}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500">Airborne Time</div>
                <div className="font-mono font-bold text-black tabular-nums">{data.airborneSeconds.toLocaleString()}s</div>
                <div className="text-[10px] text-neutral-500">{hours} flight hours</div>
              </div>
            </div>
          </div>

          {/* Environmental Ledger & Financial Settlement */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-3.5 border border-black/[0.06] shadow-xs">
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono mb-1">
                <Fuel className="w-3.5 h-3.5 text-neutral-600" />
                <span>Jet-A1 Fuel Burn</span>
              </div>
              <div className="font-mono text-xl font-bold text-black tabular-nums">
                {data.fuelBurnKg.toLocaleString()} <span className="text-xs font-normal text-neutral-500">kg</span>
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5 font-sans">ICAO Benchmark Table</div>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-black/[0.06] shadow-xs">
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono mb-1">
                <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified CO₂</span>
              </div>
              <div className="font-mono text-xl font-bold text-emerald-600 tabular-nums">
                {co2Tonnes} <span className="text-xs font-normal text-emerald-700">tonnes</span>
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5 font-sans">CORSIA Factor: 3.16x</div>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-black/[0.06] shadow-xs">
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono mb-1">
                <Zap className="w-3.5 h-3.5 text-[#7C4DFF]" />
                <span>On-Chain Settlement</span>
              </div>
              <div className="font-mono text-xl font-bold text-[#7C4DFF] tabular-nums">
                ${data.scaledCostUSDC || (data.costUSDC / 1000).toFixed(4)} <span className="text-xs font-normal text-neutral-500">USDC</span>
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5 font-sans">
                1:1,000 Scale (Real: ${data.costUSDC.toFixed(2)})
              </div>
            </div>
          </div>

          {/* Archival Cryptographic Provenance Ledger with Live Arc L1 Node Verification */}
          <div className="bg-neutral-50/90 rounded-2xl p-4 border border-black/[0.06] space-y-3 font-mono text-xs shadow-xs">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 border-b border-black/[0.06] pb-2">
              <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                ARC L1 CRYPTOGRAPHIC PROOF
              </span>
              <div className="flex items-center gap-2">
                {receiptState.isLoading ? (
                  <span className="flex items-center gap-1 text-[10px] text-neutral-500">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-neutral-400" />
                    Querying L1 Node...
                  </span>
                ) : receiptState.data?.confirmedOnL1 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold tabular-nums">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Mined Block #{receiptState.data.blockNumber}
                  </span>
                ) : (
                  <span className="text-neutral-700 font-bold tabular-nums">
                    {data.blockNumber ? `Block #${data.blockNumber}` : "Settlement Pending"}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 text-[11px]">
              {/* Transaction Hash with 1-Click Copy & Status Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-neutral-500">Transaction Hash:</span>
                {data.txHash ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-neutral-800 font-mono font-medium">
                      {data.txHash.slice(0, 14)}...{data.txHash.slice(-8)}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyTx}
                      title="Copy Full Transaction Hash"
                      className="p-1 text-neutral-400 hover:text-black rounded hover:bg-neutral-200/60 active:scale-95 transition-[transform,colors] duration-140 cursor-pointer"
                    >
                      {copiedTx ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    {receiptState.data?.isIndexedOnArcScan ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-sans font-medium">
                        ✓ ArcScan Indexed
                      </span>
                    ) : receiptState.data && !receiptState.data.isIndexedOnArcScan ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-sans font-medium cursor-help"
                        title="Transaction is 100% mined and confirmed on Arc L1 RPC. ArcScan's hosted Blockscout indexer periodically experiences crawler latency and will display the page once synced."
                      >
                        ⏳ ArcScan Indexer Syncing
                      </span>
                    ) : null}
                    {data.explorerUrl && (
                      <a
                        href={data.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-500 hover:text-black p-0.5 rounded hover:bg-neutral-200/60 transition-colors"
                        title="Open on ArcScan Explorer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="text-amber-600 font-mono text-[10.5px] font-medium">
                    Awaiting Settlement Trigger
                  </span>
                )}
              </div>

              {/* Live L1 Consensus Confirmations */}
              {receiptState.data?.confirmedOnL1 && (
                <div className="flex justify-between items-center bg-white/80 p-2 rounded-xl border border-black/[0.04]">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-600" />
                    L1 Validator Consensus:
                  </span>
                  <span className="text-emerald-700 font-semibold tabular-nums">
                    {receiptState.data.confirmations.toLocaleString()} Confirmations (Chain ID: 5042002)
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-neutral-500">1inch Aqua Vault:</span>
                <span className="text-neutral-800 tabular-nums">
                  {data.vaultAddress.slice(0, 10)}...{data.vaultAddress.slice(-8)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Authorized Agent:</span>
                <span className="text-neutral-800 tabular-nums">
                  {data.agentAddress.slice(0, 10)}...{data.agentAddress.slice(-8)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Network Gas Used:</span>
                <span className="text-neutral-700 font-medium tabular-nums">
                  {receiptState.isLoading ? (
                    <span className="inline-block w-16 h-3 bg-neutral-200 animate-pulse rounded align-middle" />
                  ) : receiptState.data?.gasUsed ? (
                    `${Number(receiptState.data.gasUsed).toLocaleString()} units · Native USDC Gas`
                  ) : (
                    <span className="text-neutral-400">Verifying on L1 RPC...</span>
                  )}
                </span>
              </div>

              {data.totalCarbonOffsetKg && (
                <div className="flex justify-between items-center pt-1.5 border-t border-black/[0.06]">
                  <span className="text-neutral-500">Total Treasury Carbon Retired:</span>
                  <span className="text-emerald-700 font-bold font-mono tabular-nums">
                    {Number(data.totalCarbonOffsetKg).toLocaleString()} kg CO₂
                  </span>
                </div>
              )}

              {/* Expandable Live Node Proof Drawer */}
              {data.txHash && (
                <div className="pt-2 border-t border-black/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowRawReceipt((prev) => !prev)}
                    className="w-full flex items-center justify-between py-1 px-2 rounded-lg bg-neutral-100/70 hover:bg-neutral-100 text-[10.5px] text-neutral-600 hover:text-black transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <Terminal className="w-3 h-3 text-neutral-500" />
                      Live Arc L1 Node RPC Proof (https://rpc.testnet.arc.network)
                    </span>
                    {showRawReceipt ? (
                      <ChevronUp className="w-3 h-3 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-neutral-400" />
                    )}
                  </button>

                  {showRawReceipt && (
                    <div className="mt-2 p-2.5 rounded-xl bg-[#0F1422] border border-white/10 text-neutral-300 font-mono text-[10px] overflow-x-auto max-h-48 custom-scrollbar animate-in fade-in zoom-in-95 duration-120">
                      <div className="text-emerald-400 font-bold mb-1">
                        // eth_getTransactionReceipt query result
                      </div>
                      <pre className="whitespace-pre-wrap leading-tight text-neutral-300">
                        {receiptState.data
                          ? JSON.stringify(receiptState.data.rawReceipt, null, 2)
                          : receiptState.isLoading
                          ? "Connecting to live Arc validator node..."
                          : receiptState.error || "No receipt data available"}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Institutional Compliance Formula Footnote */}
          <div className="bg-white rounded-xl p-3 border border-black/[0.06] text-[10.5px] font-mono text-neutral-500 leading-relaxed">
            <div className="font-semibold text-neutral-700 mb-0.5">ICAO DOC 9889 SETTLEMENT PROVENANCE</div>
            <div>
              Formula: (Δt / 3600) × {data.fuelBurnKg / Math.max(1, data.airborneSeconds / 3600)} kg/h × 3.16 CORSIA = {data.co2Kg.toLocaleString()} kg CO₂
            </div>
            <div className="text-neutral-400 mt-0.5">
              Settlement completed with zero escrow custody lockup via 1inch Aqua Registry on Arc Testnet.
            </div>
          </div>

          {/* Footer Timestamp */}
          <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-2 border-t border-black/[0.06] font-mono">
            <span>Reconciliation Timestamp: {formattedDate}</span>
            <span>RouteCO2 Protocol v1.0 (ETHOnline 2026)</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between px-6 py-3 bg-white/95 backdrop-blur-md border-t border-black/[0.06] no-print">
          {data.txHash ? (
            <button
              type="button"
              onClick={() => fetchLiveReceipt(data.txHash!)}
              disabled={receiptState.isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-black bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer active:scale-[0.97] transition-[transform,colors] duration-140"
            >
              <RefreshCw className={`w-3 h-3 ${receiptState.isLoading ? "animate-spin" : ""}`} />
              <span>Re-query Arc Node</span>
            </button>
          ) : (
            <div />
          )}

          <a
            href={data.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-xl cursor-pointer active:scale-[0.97] transition-[transform,colors] duration-140 shadow-xs"
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
