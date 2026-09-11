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
  Copy,
  Check,
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
  const [vaultCopied, setVaultCopied] = useState(false);

  const handleCopyVault = async () => {
    try {
      await navigator.clipboard.writeText(sessionData.targetVaultAddress);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = sessionData.targetVaultAddress;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
    }
    setVaultCopied(true);
    setTimeout(() => setVaultCopied(false), 1500);
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-modal-title"
        className="relative w-full max-w-lg bg-[#ECEBE6] text-[#111111] rounded-xl shadow-2xl border border-[#D4D3CD] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#D4D3CD] flex items-center justify-between bg-[#D6D5CF]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#111111] flex items-center justify-center text-[#ECEBE6]">
              <KeyRound className="w-4 h-4 text-[#FF4D00]" />
            </div>
            <div>
              <h2
                id="session-modal-title"
                className="text-sm font-bold text-[#111111] font-sans flex items-center gap-2"
              >
                <span>PRIVY SCOPED SESSION DELEGATION</span>
                <span className="btn-pill px-2.5 py-0.5 text-[10px] font-mono bg-[#ECEBE6] text-[#FF4D00] border border-[#D4D3CD] font-semibold">
                  Track 3
                </span>
              </h2>
              <p className="text-[11px] text-[#555555] font-sans">
                Bounded flight operations key for zero-popup autonomous settlements
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="icon-circle w-8 h-8 text-[#555555] hover:text-[#111111] hover:bg-[#ECEBE6] cursor-pointer transition-colors duration-140"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#111111] font-sans">
          {/* Delegation transport indicator */}
          <div className="p-3 rounded-lg bg-[#D6D5CF] border border-[#D4D3CD] text-[10.5px] font-mono text-[#555555]">
            {isSignerConfigured ? (
              <span>
                Privy session signer:{" "}
                <strong className="text-[#111111]">{privyDelegated ? "DELEGATED" : "READY"}</strong>
                {keyQuorumId && <span className="ml-1">· quorum {keyQuorumId.slice(0, 12)}…</span>}
                {policyId && <span className="ml-1">· policy {policyId.slice(0, 12)}…</span>}
              </span>
            ) : (
              <span>
                Local delegation state (explicit demo fallback): set{" "}
                <strong className="text-[#FF4D00]">NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID</strong> for
                cryptographic addSigners delegation.
              </span>
            )}
          </div>

          {/* Status Indicator Card */}
          <div className="p-3.5 rounded-lg border border-[#D4D3CD] bg-[#D6D5CF] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  sessionData.status === "Active / Delegated"
                    ? "bg-[#FF4D00] animate-pulse"
                    : sessionData.status === "Pending Authorization"
                    ? "bg-[#555555]"
                    : "bg-[#111111]"
                }`}
              />
              <div>
                <span className="font-semibold text-xs block text-[#111111]">
                  Session Status: {sessionData.status}
                </span>
                <span className="text-[10.5px] text-[#555555]">
                  {sessionData.status === "Active / Delegated"
                    ? "Cryptographically authorized for autonomous touchdown execution"
                    : sessionData.status === "Pending Authorization"
                    ? "Requires dispatcher passkey grant before flight dispatch"
                    : "Session revoked: all automated settlements blocked"}
                </span>
              </div>
            </div>

            {sessionData.status === "Active / Delegated" && (
              <div className="btn-pill text-right font-mono text-[11px] font-medium text-[#111111] bg-[#ECEBE6] px-2.5 py-1 border border-[#D4D3CD] tabular-nums">
                <Clock className="w-3 h-3 inline mr-1 text-[#FF4D00]" />
                {timeLeft}
              </div>
            )}
          </div>

          {/* Target Whitelist (Read-Only) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#111111] uppercase tracking-wider font-sans">
                Target Whitelist Policy
              </label>
              <span className="text-[10px] text-[#111111] font-mono font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#FF4D00]" />
                Hardware-Enforced Whitelist
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#D6D5CF] border border-[#D4D3CD] flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#111111] font-mono text-xs">
                    SkyRouteVault (1inch Aqua App)
                  </span>
                  <span className="btn-pill px-2 py-0.5 text-[9px] font-mono bg-[#ECEBE6] text-[#555555] border border-[#D4D3CD] font-medium">
                    Arc L1 · 5042002
                  </span>
                </div>
                <div className="text-[10.5px] font-mono text-[#555555] tabular-nums">
                  {sessionData.targetVaultAddress}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleCopyVault}
                className="icon-circle p-1.5 text-[#555555] hover:text-[#111111] transition-colors duration-140 cursor-pointer"
                title={vaultCopied ? "Copied!" : "Copy vault address"}
                aria-label="Copy vault address"
              >
                {vaultCopied ? (
                  <Check className="w-3.5 h-3.5 text-[#1E6B37]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <a
                href={`https://testnet.arcscan.app/address/${sessionData.targetVaultAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="icon-circle p-1.5 text-[#555555] hover:text-[#111111] transition-colors duration-140 cursor-pointer"
                title="Verify on ArcScan"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              </div>
            </div>
            <p className="text-[10.5px] text-[#555555]">
              Session key is restricted strictly to calls against SkyRouteVault and native USDC. Any
              unauthorized contract call or transfer outside this scope is rejected.
            </p>
          </div>

          {/* Per-Flight Budget Cap */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#111111] uppercase tracking-wider font-sans">
                Per-Flight Budget Cap (USDC)
              </label>
              <span className="text-[10.5px] font-mono text-[#555555]">
                Active Cap:{" "}
                <strong className="text-[#111111] font-semibold">
                  ${sessionData.budgetCapUSDC.toFixed(2)} USDC
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-[#555555] font-mono text-xs">
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
                  className="w-full pl-6 pr-14 py-2 bg-[#ECEBE6] rounded-lg border border-[#D4D3CD] text-xs font-mono font-medium text-[#111111] focus:outline-none focus:border-[#FF4D00] transition-colors duration-140 tabular-nums"
                />
                <span className="absolute right-3 top-2.5 text-[#555555] font-mono text-[10.5px]">
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
                    className={`btn-pill px-3 py-1.5 text-[10.5px] font-mono font-medium cursor-pointer transition-colors duration-140 ${
                      editableCap === cap
                        ? "bg-[#111111] text-[#ECEBE6]"
                        : "bg-[#ECEBE6] text-[#555555] hover:text-[#111111] border border-[#D4D3CD]"
                    }`}
                  >
                    ${cap >= 1000 ? `${cap / 1000}k` : cap}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10.5px] text-[#555555]">
              The autonomous Circle dispatcher cannot draw more than this cap in a single touchdown
              settlement. Excess draws are rejected on-chain.
            </p>
          </div>

          {/* Session Expiry Duration */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#111111] uppercase tracking-wider font-sans">
                Session Expiry Window
              </label>
              <span className="text-[10.5px] font-mono text-[#555555]">
                Duration: <strong className="text-[#111111]">{sessionData.expiryHours} hours</strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {quickHours.map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  onClick={() => onUpdateExpiryHours(hrs)}
                  className={`btn-pill py-2 px-3 border text-xs font-medium cursor-pointer transition-colors duration-140 flex items-center justify-center gap-1.5 ${
                    sessionData.expiryHours === hrs
                      ? "bg-[#111111] text-[#ECEBE6] border-[#111111]"
                      : "bg-[#ECEBE6] text-[#555555] border-[#D4D3CD] hover:text-[#111111]"
                  }`}
                >
                  <Clock className="w-3 h-3 text-[#FF4D00]" />
                  <span>{hrs} Hours</span>
                </button>
              ))}
            </div>
          </div>

          {/* Passkey / Zero-Popup Dispatch Notice */}
          <div className="p-3.5 rounded-lg bg-[#D6D5CF] border border-[#D4D3CD] text-[#111111] flex items-start gap-2.5">
            <Fingerprint className="w-4 h-4 text-[#FF4D00] shrink-0 mt-0.5" />
            <div className="text-[10.5px] text-[#555555] leading-relaxed">
              <strong className="font-semibold text-[#111111] block mb-0.5">
                Privy Embedded Passkey Authentication
              </strong>
              Once delegated, the autonomous Circle background daemon verifies ADS-B transponder
              telemetry and settles on-chain atomically without interrupting the flight dispatcher
              with popup confirmations.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#D6D5CF]/60 border-t border-[#D4D3CD] flex items-center justify-between gap-3 font-sans">
          {/* 1-Click Emergency Abort / Revoke Button */}
          <button
            type="button"
            onClick={onRevokeSession}
            disabled={sessionData.status === "Revoked"}
            className={`btn-pill flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors duration-140 border ${
              sessionData.status === "Revoked"
                ? "bg-[#ECEBE6] text-[#555555]/50 border-[#D4D3CD] cursor-not-allowed"
                : "bg-[#ECEBE6] text-[#111111] hover:text-[#FF4D00] border-[#D4D3CD] hover:border-[#FF4D00]"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#FF4D00]" />
            <span>Emergency Abort</span>
          </button>

          {/* Authorize / Renew Session Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-pill px-3.5 py-2 text-xs font-medium text-[#555555] hover:text-[#111111] cursor-pointer transition-colors duration-140 font-sans"
            >
              Done
            </button>
            <button
              type="button"
              onClick={onAuthorizeSession}
              className="btn-pill flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#ECEBE6] bg-[#111111] hover:bg-[#FF4D00] cursor-pointer transition-colors duration-140 font-sans"
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
