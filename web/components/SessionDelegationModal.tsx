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
}

export function SessionDelegationModal({
  isOpen,
  onClose,
  sessionData,
  onUpdateBudgetCap,
  onUpdateExpiryHours,
  onAuthorizeSession,
  onRevokeSession,
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

  const quickCaps = [250, 500, 1000, 2500];
  const quickHours = [4, 8, 24];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-modal-title"
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-black/10 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.08] flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center text-white">
              <KeyRound className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2
                id="session-modal-title"
                className="text-sm font-bold text-black font-sans flex items-center gap-2"
              >
                <span>Privy Scoped Session Delegation</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-100 text-purple-800 border border-purple-300 font-semibold">
                  Track 3
                </span>
              </h2>
              <p className="text-[11px] text-neutral-500 font-sans">
                Bounded flight operations key for zero-popup autonomous settlements
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-neutral-400 hover:text-black rounded-xl hover:bg-neutral-100 cursor-pointer active:scale-[0.92] transition-colors duration-140"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4.5 text-xs text-neutral-700">
          {/* Status Indicator Card */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between ${
              sessionData.status === "Active / Delegated"
                ? "bg-emerald-50/60 border-emerald-300/60 text-emerald-950"
                : sessionData.status === "Pending Authorization"
                ? "bg-amber-50/60 border-amber-300/60 text-amber-950"
                : "bg-rose-50/60 border-rose-300/60 text-rose-950"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                {sessionData.status === "Active / Delegated" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    sessionData.status === "Active / Delegated"
                      ? "bg-emerald-500"
                      : sessionData.status === "Pending Authorization"
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                />
              </span>
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
              <div className="text-right font-mono text-[11px] font-medium text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-xl border border-emerald-300/60 tabular-nums">
                <Clock className="w-3 h-3 inline mr-1 text-emerald-600" />
                {timeLeft}
              </div>
            )}
          </div>

          {/* Target Whitelist (Read-Only) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-neutral-800 uppercase tracking-wider">
                Target Whitelist Policy
              </label>
              <span className="text-[10px] text-emerald-700 font-mono font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Hardware-Enforced Whitelist
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-neutral-100/80 border border-black/[0.06] flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-900 font-mono text-xs">
                    SkyRouteVault (1inch Aqua App)
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono bg-neutral-200/80 text-neutral-700 rounded-md font-medium">
                    Arc L1 · 5042002
                  </span>
                </div>
                <div className="text-[10.5px] font-mono text-neutral-500 tabular-nums">
                  {sessionData.targetVaultAddress}
                </div>
              </div>
              <a
                href={`https://testnet.arcscan.app/address/${sessionData.targetVaultAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-neutral-400 hover:text-black rounded-lg hover:bg-neutral-200/70 transition-colors duration-140 cursor-pointer"
                title="Verify on ArcScan"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-[10.5px] text-neutral-400">
              Session key is restricted strictly to calls against SkyRouteVault and native USDC. Any
              unauthorized contract call or transfer outside this scope is rejected.
            </p>
          </div>

          {/* Per-Flight Budget Cap */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-neutral-800 uppercase tracking-wider">
                Per-Flight Budget Cap (USDC)
              </label>
              <span className="text-[10.5px] font-mono text-neutral-500">
                Active Cap:{" "}
                <strong className="text-black font-semibold">
                  ${sessionData.budgetCapUSDC.toFixed(2)} USDC
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-neutral-400 font-mono text-xs">
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
                  className="w-full pl-6 pr-14 py-2 bg-neutral-50 border border-black/[0.1] rounded-xl text-xs font-mono font-medium text-black focus:outline-none focus:border-black focus:bg-white transition-colors duration-140 tabular-nums"
                />
                <span className="absolute right-3 top-2.5 text-neutral-400 font-mono text-[10.5px]">
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
                    className={`px-2 py-2 rounded-xl text-[10.5px] font-mono font-medium cursor-pointer active:scale-[0.96] transition-colors duration-140 ${
                      editableCap === cap
                        ? "bg-black text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-black"
                    }`}
                  >
                    ${cap}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10.5px] text-neutral-400">
              The autonomous Circle dispatcher cannot draw more than this cap in a single touchdown
              settlement. Excess draws are rejected on-chain.
            </p>
          </div>

          {/* Session Expiry Duration */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-neutral-800 uppercase tracking-wider">
                Session Expiry Window
              </label>
              <span className="text-[10.5px] font-mono text-neutral-500">
                Duration: <strong className="text-black">{sessionData.expiryHours} hours</strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {quickHours.map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  onClick={() => onUpdateExpiryHours(hrs)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium cursor-pointer active:scale-[0.97] transition-colors duration-140 flex items-center justify-center gap-1.5 ${
                    sessionData.expiryHours === hrs
                      ? "bg-neutral-900 text-white border-black"
                      : "bg-neutral-50 text-neutral-700 border-black/[0.08] hover:bg-neutral-100"
                  }`}
                >
                  <Clock className="w-3 h-3 opacity-70" />
                  <span>{hrs} Hours</span>
                </button>
              ))}
            </div>
          </div>

          {/* Passkey / Zero-Popup Dispatch Notice */}
          <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200/70 text-purple-950 flex items-start gap-2.5">
            <Fingerprint className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-[10.5px] leading-relaxed">
              <strong className="font-semibold text-purple-900 block">
                Privy Embedded Passkey Authentication
              </strong>
              Once delegated, the autonomous Circle background daemon verifies ADS-B transponder
              telemetry and settles on-chain atomically without interrupting the flight dispatcher
              with popup confirmations.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-neutral-50/80 border-t border-black/[0.08] flex items-center justify-between gap-3">
          {/* 1-Click Emergency Abort / Revoke Button */}
          <button
            type="button"
            onClick={onRevokeSession}
            disabled={sessionData.status === "Revoked"}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl cursor-pointer active:scale-[0.96] transition-colors duration-140 border ${
              sessionData.status === "Revoked"
                ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-300 shadow-2xs"
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
              className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-black rounded-xl hover:bg-neutral-100 cursor-pointer transition-colors duration-140"
            >
              Done
            </button>
            <button
              type="button"
              onClick={onAuthorizeSession}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-xl cursor-pointer active:scale-[0.97] transition-colors duration-140 shadow-xs"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
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
