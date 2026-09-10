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
  /** Recorded-track audit binding (present when settled from a recording). */
  observedSeconds?: number;
  fixCount?: number;
  recordingHash?: string;
  trackSource?: string;
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
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#272e33] shadow-2xl border border-dashed border-[#d3c6aa]/20 flex flex-col custom-scrollbar animate-in zoom-in-95 duration-180 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#1e2528]/95 backdrop-blur-md border-b border-dashed border-[#d3c6aa]/16 no-print">
          <div className="flex items-center gap-2.5">
            <RouteCo2Logo className="w-8 h-8 border border-dashed border-[#d3c6aa]/20 shrink-0" />
            <div>
              <div className="text-xs font-mono font-bold tracking-wider text-[#d3c6aa]">
                ROUTECO2 // FLIGHT OPERATIONS
              </div>
              <div className="text-[10px] text-[#859289]">
                ICAO Doc 9889 Verified Carbon Reconciliation
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              title="Print Operations Receipt (Cmd+P)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#9daaa4] bg-[#2d353b] hover:bg-[#343f44] hover:text-[#d3c6aa] cursor-pointer active:scale-[0.96] transition-[transform,colors] duration-140"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 text-[#859289] hover:text-[#d3c6aa] hover:bg-[#d3c6aa]/10 cursor-pointer active:scale-[0.92] transition-[transform,colors] duration-140"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Certificate Body */}
        <div className="p-6 space-y-5">
          {/* Certificate Title Banner */}
          <div className="text-center py-2 border-b border-dashed border-[#d3c6aa]/16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 bg-[#a7c080]/[0.08] text-[#a7c080] border border-dashed border-[#a7c080]/40 text-[11px] font-mono font-semibold">
              <span className="w-1.5 h-1.5 bg-[#a7c080] blink-step" />
              <span>WHEELS-DOWN ON-CHAIN RECONCILIATION VERIFIED</span>
            </div>
            <h2 className="font-mono text-2xl font-bold text-[#d3c6aa] tracking-tight uppercase">
              Executive Carbon Reconciliation Certificate
            </h2>
            <p className="text-xs text-[#859289] max-w-md mx-auto mt-1 font-mono">
              Automated zero-custody settlement executed on Arc Testnet via 1inch Aqua.
            </p>
          </div>

          {/* Flight Manifest & Telemetry Table */}
          <div className="bg-[#1e2528] p-4 border border-dashed border-[#d3c6aa]/16">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#859289] mb-3 flex items-center justify-between">
              <span>Flight Manifest & Telemetry</span>
              <span className="text-[#859289]/70">ICAO Transponder: 0x{data.icao24.toUpperCase().replace("0X", "")}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-[10px] text-[#859289]">Callsign</div>
                <div className="font-mono font-bold text-sm text-[#d3c6aa] tabular-nums">{data.callsign}</div>
                <div className="text-[10px] text-[#859289]">{data.airline}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#859289]">Airframe</div>
                <div className="font-semibold text-[#d3c6aa]">{data.airframe}</div>
                <div className="text-[10px] text-[#859289] font-mono">Runway {data.runway}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#859289]">Route</div>
                <div className="font-mono font-bold text-[#d3c6aa]">
                  {data.originAirport} → {data.destinationAirport}
                </div>
                <div className="text-[10px] text-[#859289] truncate">{data.destinationName}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#859289]">Airborne Time</div>
                <div className="font-mono font-bold text-[#d3c6aa] tabular-nums">{data.airborneSeconds.toLocaleString()}s</div>
                <div className="text-[10px] text-[#859289]">{hours} flight hours</div>
              </div>
            </div>
          </div>

          {/* Environmental Ledger & Financial Settlement */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#1e2528] p-3.5 border border-dashed border-[#d3c6aa]/16">
              <div className="flex items-center gap-1.5 text-[10px] text-[#859289] font-mono mb-1">
                <Fuel className="w-3.5 h-3.5 text-[#e69875]" />
                <span>Jet-A1 Fuel Burn</span>
              </div>
              <div className="font-mono text-xl font-bold text-[#d3c6aa] tabular-nums">
                {data.fuelBurnKg.toLocaleString()} <span className="text-xs font-normal text-[#859289]">kg</span>
              </div>
              <div className="text-[10px] text-[#859289] mt-0.5 font-mono">ICAO Benchmark Table</div>
            </div>

            <div className="bg-[#1e2528] p-3.5 border border-dashed border-[#a7c080]/30">
              <div className="flex items-center gap-1.5 text-[10px] text-[#859289] font-mono mb-1">
                <Leaf className="w-3.5 h-3.5 text-[#a7c080]" />
                <span>Verified CO₂</span>
              </div>
              <div className="font-mono text-xl font-bold text-[#a7c080] tabular-nums">
                {co2Tonnes} <span className="text-xs font-normal text-[#a7c080]/80">tonnes</span>
              </div>
              <div className="text-[10px] text-[#859289] mt-0.5 font-mono">CORSIA Factor: 3.16x</div>
            </div>

            <div className="bg-[#1e2528] p-3.5 border border-dashed border-[#dbbc7f]/30">
              <div className="flex items-center gap-1.5 text-[10px] text-[#859289] font-mono mb-1">
                <Zap className="w-3.5 h-3.5 text-[#dbbc7f]" />
                <span>On-Chain Settlement</span>
              </div>
              <div className="font-mono text-xl font-bold text-[#dbbc7f] tabular-nums">
                ${data.scaledCostUSDC || (data.costUSDC / 1000).toFixed(4)} <span className="text-xs font-normal text-[#859289]">USDC</span>
              </div>
              <div className="text-[10px] text-[#859289] mt-0.5 font-mono">
                1:1,000 Scale (Real: ${data.costUSDC.toFixed(2)})
              </div>
            </div>
          </div>

          {/* Archival Cryptographic Provenance Ledger with Live Arc L1 Node Verification */}
          <div className="bg-[#1e2528]/90 p-4 border border-dashed border-[#d3c6aa]/16 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-[#859289] border-b border-dashed border-[#d3c6aa]/16 pb-2">
              <span className="flex items-center gap-1.5 text-[#a7c080] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-[#a7c080]" />
                ARC L1 CRYPTOGRAPHIC PROOF
              </span>
              <div className="flex items-center gap-2">
                {receiptState.isLoading ? (
                  <span className="flex items-center gap-1 text-[10px] text-[#859289]">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-[#859289]" />
                    Querying L1 Node...
                  </span>
                ) : receiptState.data?.confirmedOnL1 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-[#a7c080] font-bold tabular-nums">
                    <span className="w-1.5 h-1.5 bg-[#a7c080] blink-step" />
                    Mined Block #{receiptState.data.blockNumber}
                  </span>
                ) : (
                  <span className="text-[#9daaa4] font-bold tabular-nums">
                    {data.blockNumber ? `Block #${data.blockNumber}` : "Settlement Pending"}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 text-[11px]">
              {/* Recorded-track audit binding (only for recording-sourced settlements) */}
              {data.fixCount ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-dashed border-[#d3c6aa]/[0.08]">
                  <span className="text-[#859289]">Recorded Track Proof:</span>
                  <span
                    title={`Observed ${data.observedSeconds ?? 0}s across ${data.fixCount} live ADS-B fixes (partial-leg observation). Recording hash ${data.recordingHash || "—"}.`}
                    className="text-[#7fbbb3] font-mono font-medium tabular-nums"
                  >
                    {data.fixCount} fixes · {Math.round((data.observedSeconds ?? 0) / 60)} min observed · #{data.recordingHash || "—"}
                  </span>
                </div>
              ) : null}
              {/* Transaction Hash with 1-Click Copy & Status Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-[#859289]">Transaction Hash:</span>
                {data.txHash ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[#d3c6aa] font-mono font-medium">
                      {data.txHash.slice(0, 14)}...{data.txHash.slice(-8)}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyTx}
                      title="Copy Full Transaction Hash"
                      className="p-1 text-[#859289] hover:text-[#d3c6aa] active:scale-95 transition-[transform,colors] duration-140 cursor-pointer"
                    >
                      {copiedTx ? (
                        <Check className="w-3 h-3 text-[#a7c080]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    {receiptState.data?.isIndexedOnArcScan ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#a7c080]/15 text-[#a7c080] text-[10px] font-mono font-medium">
                        ✓ ArcScan Indexed
                      </span>
                    ) : receiptState.data && !receiptState.data.isIndexedOnArcScan ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#dbbc7f]/15 text-[#dbbc7f] text-[10px] font-mono font-medium cursor-help"
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
                        className="text-[#859289] hover:text-[#d3c6aa] p-0.5 hover:bg-[#d3c6aa]/10 transition-colors"
                        title="Open on ArcScan Explorer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="text-[#dbbc7f] font-mono text-[10.5px] font-medium">
                    Awaiting Settlement Trigger
                  </span>
                )}
              </div>

              {/* Live L1 Consensus Confirmations */}
              {receiptState.data?.confirmedOnL1 && (
                <div className="flex justify-between items-center bg-[#2d353b]/80 p-2 border border-dashed border-[#d3c6aa]/[0.08]">
                  <span className="text-[#859289] flex items-center gap-1">
                    <Activity className="w-3 h-3 text-[#a7c080]" />
                    L1 Validator Consensus:
                  </span>
                  <span className="text-[#a7c080] font-semibold tabular-nums">
                    {receiptState.data.confirmations.toLocaleString()} Confirmations (Chain ID: 5042002)
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-[#859289]">1inch Aqua Vault:</span>
                <span className="text-[#d3c6aa] tabular-nums">
                  {data.vaultAddress.slice(0, 10)}...{data.vaultAddress.slice(-8)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#859289]">Authorized Agent:</span>
                <span className="text-[#d3c6aa] tabular-nums">
                  {data.agentAddress.slice(0, 10)}...{data.agentAddress.slice(-8)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#859289]">Network Gas Used:</span>
                <span className="text-[#9daaa4] font-medium tabular-nums">
                  {receiptState.isLoading ? (
                    <span className="inline-block w-16 h-3 bg-[#d3c6aa]/15 animate-pulse align-middle" />
                  ) : receiptState.data?.gasUsed ? (
                    `${Number(receiptState.data.gasUsed).toLocaleString()} units · Native USDC Gas`
                  ) : (
                    <span className="text-[#859289]">Verifying on L1 RPC...</span>
                  )}
                </span>
              </div>

              {data.totalCarbonOffsetKg && (
                <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-[#d3c6aa]/16">
                  <span className="text-[#859289]">Total Treasury Carbon Retired:</span>
                  <span className="text-[#a7c080] font-bold font-mono tabular-nums">
                    {Number(data.totalCarbonOffsetKg).toLocaleString()} kg CO₂
                  </span>
                </div>
              )}

              {/* Expandable Live Node Proof Drawer */}
              {data.txHash && (
                <div className="pt-2 border-t border-dashed border-[#d3c6aa]/16">
                  <button
                    type="button"
                    onClick={() => setShowRawReceipt((prev) => !prev)}
                    className="w-full flex items-center justify-between py-1 px-2 bg-[#2d353b] hover:bg-[#343f44] text-[10.5px] text-[#9daaa4] hover:text-[#d3c6aa] transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <Terminal className="w-3 h-3 text-[#859289]" />
                      Live Arc L1 Node RPC Proof (https://rpc.testnet.arc.network)
                    </span>
                    {showRawReceipt ? (
                      <ChevronUp className="w-3 h-3 text-[#859289]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[#859289]" />
                    )}
                  </button>

                  {showRawReceipt && (
                    <div className="mt-2 p-2.5 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 text-[#9daaa4] font-mono text-[10px] overflow-x-auto max-h-48 custom-scrollbar animate-in fade-in zoom-in-95 duration-120">
                      <div className="text-[#a7c080] font-bold mb-1">
                        // eth_getTransactionReceipt query result
                      </div>
                      <pre className="whitespace-pre-wrap leading-tight text-[#9daaa4]">
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
          <div className="bg-[#1e2528] p-3 border border-dashed border-[#d3c6aa]/16 text-[10.5px] font-mono text-[#859289] leading-relaxed">
            <div className="font-semibold text-[#9daaa4] mb-0.5">ICAO DOC 9889 SETTLEMENT PROVENANCE</div>
            <div>
              Formula: (Δt / 3600) × {data.fuelBurnKg / Math.max(1, data.airborneSeconds / 3600)} kg/h × 3.16 CORSIA = {data.co2Kg.toLocaleString()} kg CO₂
            </div>
            <div className="text-[#859289]/70 mt-0.5">
              Settlement completed with zero escrow custody lockup via 1inch Aqua Registry on Arc Testnet.
            </div>
          </div>

          {/* Footer Timestamp */}
          <div className="flex items-center justify-between text-[10px] text-[#859289] pt-2 border-t border-dashed border-[#d3c6aa]/16 font-mono">
            <span>Reconciliation Timestamp: {formattedDate}</span>
            <span>RouteCO2 Protocol v1.0 (ETHOnline 2026)</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between px-6 py-3 bg-[#1e2528]/95 backdrop-blur-md border-t border-dashed border-[#d3c6aa]/16 no-print">
          {data.txHash ? (
            <button
              type="button"
              onClick={() => fetchLiveReceipt(data.txHash!)}
              disabled={receiptState.isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#9daaa4] hover:text-[#d3c6aa] bg-[#2d353b] hover:bg-[#343f44] cursor-pointer active:scale-[0.97] transition-[transform,colors] duration-140"
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
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#2d353b] bg-[#a7c080] hover:bg-[#dbbc7f] cursor-pointer active:scale-[0.97] transition-[transform,colors] duration-140"
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
