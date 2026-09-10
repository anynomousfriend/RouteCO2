"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Fingerprint,
} from "lucide-react";

export interface SessionDelegationData {
  status: "Active / Delegated" | "Pending Authorization" | "Revoked";
  budgetCapUSDC: number;
  expiryHours: number;
  expiresAt: number; // timestamp in ms
  targetVaultAddress: string;
}

interface SessionDelegationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: SessionDelegationData;
  onUpdateBudgetCap: (cap: number) => void;
  onUpdateExpiryHours: (hours: number) => void;
  onAuthorizeSession: () => void;
  onRevokeSession: () => void;
  /** Real Privy delegation state (docs.privy.io signers); when false the modal labels local fallback. */
  privyDelegated?: boolean;
  isSignerConfigured?: boolean;
  keyQuorumId?: string;
  policyId?: string;
}

export function SessionDelegationModal({
  isOpen,
  onClose,
  sessionData,
  onUpdateBudgetCap,
  onUpdateExpiryHours,
  onAuthorizeSession,
  onRevokeSession,
  privyDelegated = false,
  isSignerConfigured = false,
  keyQuorumId = "",
  policyId = "",
}: SessionDelegationModalProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [editableCap, setEditableCap] = useState<number>(sessionData.budgetCapUSDC);

  useEffect(() => {
    setEditableCap(sessionData.budgetCapUSDC);
  }, [sessionData.budgetCapUSDC]);

  // Live countdown timer for active session
  useEffect(() => {
    if (!isOpen) return;

    const updateTimer = () => {
      if (sessionData.status !== "Active / Delegated") {
        setTimeLeft("Inactive");
        return;
      }
      const remainingMs = sessionData.expiresAt - Date.now();
      if (remainingMs <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const totalSecs = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      setTimeLeft(
        `${hours.toString().padStart(2, "0")}h ${mins
          .toString()
          .padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, sessionData.expiresAt, sessionData.status]);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickCaps = [500, 1000, 3000, 5000, 10000];
  const quickHours = [4, 8, 24];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-modal-title"
        className="relative w-full max-w-lg bg-[#272e33] shadow-2xl border border-dashed border-[#d3c6aa]/20 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dashed border-[#d3c6aa]/16 flex items-center justify-between bg-[#1e2528]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#a7c080] flex items-center justify-center text-[#2d353b]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="session-modal-title"
                className="text-sm font-bold text-[#d3c6aa] font-mono flex items-center gap-2"
              >
                <span>PRIVY SCOPED SESSION DELEGATION</span>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-[#dbbc7f]/15 text-[#dbbc7f] border border-dashed border-[#dbbc7f]/40 font-semibold">
                  Track 3
                </span>
              </h2>
              <p className="text-[11px] text-[#859289] font-mono">
                Bounded flight operations key for zero-popup autonomous settlements
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-[#859289] hover:text-[#d3c6aa] hover:bg-[#d3c6aa]/10 cursor-pointer active:scale-[0.92] transition-colors duration-140"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4.5 text-xs text-[#9daaa4] font-mono">
          {/* Delegation transport indicator: cryptographic Privy signer vs explicit local state */}
          <div className="p-2.5 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 text-[10.5px] font-mono text-[#859289]">
            {isSignerConfigured ? (
              <span>
                Privy session signer:{" "}
                <strong className="text-[#a7c080]">{privyDelegated ? "DELEGATED" : "READY"}</strong>
                {keyQuorumId && <span className="ml-1">· quorum {keyQuorumId.slice(0, 12)}…</span>}
                {policyId && <span className="ml-1">· policy {policyId.slice(0, 12)}…</span>}
              </span>
            ) : (
              <span>
                Local delegation state (explicit demo fallback) — set{" "}
                <strong className="text-[#dbbc7f]">NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID</strong> for
                cryptographic addSigners delegation.
              </span>
            )}
          </div>
          {/* Status Indicator Card */}
          <div
            className={`p-3.5 border flex items-center justify-between ${
              sessionData.status === "Active / Delegated"
                ? "bg-[#a7c080]/[0.08] border-dashed border-[#a7c080]/40 text-[#a7c080]"
                : sessionData.status === "Pending Authorization"
                ? "bg-[#dbbc7f]/[0.08] border-dashed border-[#dbbc7f]/40 text-[#dbbc7f]"
                : "bg-[#e67e80]/[0.08] border-dashed border-[#e67e80]/40 text-[#e67e80]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 ${
                  sessionData.status === "Active / Delegated"
                    ? "bg-[#a7c080] blink-step"
                    : sessionData.status === "Pending Authorization"
                    ? "bg-[#dbbc7f]"
                    : "bg-[#e67e80]"
                }`}
              />
              <div>
                <span className="font-semibold text-xs block">
                  Session Status: {sessionData.status}
                </span>
                <span className="text-[10.5px] opacity-80">
                  {sessionData.status === "Active / Delegated"
                    ? "Cryptographically authorized for autonomous touchdown execution"
                    : sessionData.status === "Pending Authorization"
                    ? "Requires dispatcher passkey grant before flight dispatch"
                    : "Session revoked — all automated settlements blocked"}
                </span>
              </div>
            </div>

            {sessionData.status === "Active / Delegated" && (
              <div className="text-right font-mono text-[11px] font-medium text-[#a7c080] bg-[#a7c080]/15 px-2.5 py-1 border border-dashed border-[#a7c080]/40 tabular-nums">
                <Clock className="w-3 h-3 inline mr-1 text-[#a7c080]" />
                {timeLeft}
              </div>
            )}
          </div>

          {/* Target Whitelist (Read-Only) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#d3c6aa] uppercase tracking-wider">
                Target Whitelist Policy
              </label>
              <span className="text-[10px] text-[#a7c080] font-mono font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#a7c080]" />
                Hardware-Enforced Whitelist
              </span>
            </div>
            <div className="p-3 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#d3c6aa] font-mono text-xs">
                    SkyRouteVault (1inch Aqua App)
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono bg-[#d3c6aa]/10 text-[#9daaa4] font-medium">
                    Arc L1 · 5042002
                  </span>
                </div>
                <div className="text-[10.5px] font-mono text-[#859289] tabular-nums">
                  {sessionData.targetVaultAddress}
                </div>
              </div>
              <a
                href={`https://testnet.arcscan.app/address/${sessionData.targetVaultAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-[#859289] hover:text-[#d3c6aa] hover:bg-[#d3c6aa]/10 transition-colors duration-140 cursor-pointer"
                title="Verify on ArcScan"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-[10.5px] text-[#859289]">
              Session key is restricted strictly to calls against SkyRouteVault and native USDC. Any
              unauthorized contract call or transfer outside this scope is rejected.
            </p>
          </div>

          {/* Per-Flight Budget Cap */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#d3c6aa] uppercase tracking-wider">
                Per-Flight Budget Cap (USDC)
              </label>
              <span className="text-[10.5px] font-mono text-[#859289]">
                Active Cap:{" "}
                <strong className="text-[#dbbc7f] font-semibold">
                  ${sessionData.budgetCapUSDC.toFixed(2)} USDC
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-[#859289] font-mono text-xs">
                  $
                </span>
                <input
                  type="number"
                  min="10"
                  max="100000"
                  value={editableCap}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setEditableCap(val);
                    onUpdateBudgetCap(val);
                  }}
                  className="w-full pl-6 pr-14 py-2 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 text-xs font-mono font-medium text-[#d3c6aa] focus:outline-none focus:border-[#dbbc7f]/60 transition-colors duration-140 tabular-nums"
                />
                <span className="absolute right-3 top-2.5 text-[#859289] font-mono text-[10.5px]">
                  USDC
                </span>
              </div>

              {/* Quick Select Caps */}
              <div className="flex items-center gap-1">
                {quickCaps.map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => {
                      setEditableCap(cap);
                      onUpdateBudgetCap(cap);
                    }}
                    className={`px-2 py-2 text-[10.5px] font-mono font-medium cursor-pointer active:scale-[0.96] transition-colors duration-140 ${
                      editableCap === cap
                        ? "bg-[#d3c6aa] text-[#2d353b]"
                        : "bg-[#1e2528] text-[#9daaa4] hover:text-[#d3c6aa] border border-dashed border-[#d3c6aa]/16"
                    }`}
                  >
                    ${cap >= 1000 ? `${cap / 1000}k` : cap}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10.5px] text-[#859289]">
              The autonomous Circle dispatcher cannot draw more than this cap in a single touchdown
              settlement. Excess draws are rejected on-chain.
            </p>
          </div>

          {/* Session Expiry Duration */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#d3c6aa] uppercase tracking-wider">
                Session Expiry Window
              </label>
              <span className="text-[10.5px] font-mono text-[#859289]">
                Duration: <strong className="text-[#d3c6aa]">{sessionData.expiryHours} hours</strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {quickHours.map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  onClick={() => onUpdateExpiryHours(hrs)}
                  className={`py-2 px-3 border text-xs font-medium cursor-pointer active:scale-[0.97] transition-colors duration-140 flex items-center justify-center gap-1.5 ${
                    sessionData.expiryHours === hrs
                      ? "bg-[#a7c080] text-[#2d353b] border-[#a7c080]"
                      : "bg-[#1e2528] text-[#9daaa4] border-dashed border-[#d3c6aa]/16 hover:text-[#d3c6aa]"
                  }`}
                >
                  <Clock className="w-3 h-3 opacity-70" />
                  <span>{hrs} Hours</span>
                </button>
              ))}
            </div>
          </div>

          {/* Passkey / Zero-Popup Dispatch Notice */}
          <div className="p-3 bg-[#7fbbb3]/[0.06] border border-dashed border-[#7fbbb3]/30 text-[#7fbbb3] flex items-start gap-2.5">
            <Fingerprint className="w-4 h-4 text-[#7fbbb3] shrink-0 mt-0.5" />
            <div className="text-[10.5px] leading-relaxed">
              <strong className="font-semibold text-[#7fbbb3] block">
                Privy Embedded Passkey Authentication
              </strong>
              Once delegated, the autonomous Circle background daemon verifies ADS-B transponder
              telemetry and settles on-chain atomically without interrupting the flight dispatcher
              with popup confirmations.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#1e2528]/60 border-t border-dashed border-[#d3c6aa]/16 flex items-center justify-between gap-3">
          {/* 1-Click Emergency Abort / Revoke Button */}
          <button
            type="button"
            onClick={onRevokeSession}
            disabled={sessionData.status === "Revoked"}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold cursor-pointer active:scale-[0.96] transition-colors duration-140 border ${
              sessionData.status === "Revoked"
                ? "bg-[#1e2528] text-[#859289]/50 border-dashed border-[#d3c6aa]/[0.08] cursor-not-allowed"
                : "bg-[#e67e80]/10 text-[#e67e80] hover:bg-[#e67e80]/20 border-dashed border-[#e67e80]/40"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Emergency Abort</span>
          </button>

          {/* Authorize / Renew Session Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-[#859289] hover:text-[#d3c6aa] hover:bg-[#d3c6aa]/10 cursor-pointer transition-colors duration-140 font-mono"
            >
              Done
            </button>
            <button
              type="button"
              onClick={onAuthorizeSession}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#2d353b] bg-[#a7c080] hover:bg-[#dbbc7f] cursor-pointer active:scale-[0.97] transition-[transform,colors] duration-140 font-mono"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>
                {sessionData.status === "Active / Delegated"
                  ? "Re-Authorize Key"
                  : "Authorize Session Key"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
