"use client";

import React, { useState } from "react";
import {
  Plane,
  Calendar,
  ShieldCheck,
  Layers,
  Wallet,
  Menu,
  KeyRound,
  Clock,
  FlaskConical,
  Copy,
  Check,
} from "lucide-react";

/** Clipboard write with legacy fallback (non-secure contexts lack the API). */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

interface NavigationDockProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAudit: () => void;
  onOpenAqua: () => void;
  onOpenSession: () => void;
  onOpenByok?: () => void;
  byokActive?: boolean;
  onConnectWallet: () => void;
  isWalletConnected: boolean;
  walletAddress?: string;
  treasuryBalance?: string | null;
  sessionCapUSDC?: number;
  sessionStatus?: "Active / Delegated" | "Pending Authorization" | "Revoked";
  landedPendingCount?: number;
}

export function NavigationDock({
  activeTab,
  onSelectTab,
  onOpenAudit,
  onOpenAqua,
  onOpenSession,
  onConnectWallet,
  onOpenByok,
  byokActive = false,
  isWalletConnected,
  walletAddress,
  treasuryBalance,
  sessionCapUSDC = 500,
  sessionStatus = "Active / Delegated",
  landedPendingCount = 4,
}: NavigationDockProps) {
  const navItems = [
    { id: "radar", icon: Plane, label: "Airspace Radar" },
    { id: "schedule", icon: Calendar, label: "Flight Scenarios" },
    { id: "landed", icon: Clock, label: "Landed (Pending Settlement)", badge: landedPendingCount },
    { id: "aqua", icon: Layers, label: "1inch Aqua Shared TVU", action: onOpenAqua },
    { id: "certificates", icon: ShieldCheck, label: "Audit Certificates", action: onOpenAudit },
    ...(onOpenByok
      ? [{ id: "byok", icon: FlaskConical, label: byokActive ? "BYOK Active: Test With Your Key" : "Test It Yourself (BYOK)", action: onOpenByok }]
      : []),
  ];

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "";
  const [addressCopied, setAddressCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    if (await copyToClipboard(walletAddress)) {
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 1500);
    }
  };

  return (
    <aside className="w-14 h-full bg-[#ECEBE6] border-r border-[#D4D3CD] flex flex-col items-center justify-between py-3 shrink-0 select-none z-20">
      {/* Top Section: Navigation Items */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2">
        <a
          href="/"
          title="Return to Protocol Overview & Judge Specs"
          className="group relative w-10 h-10 rounded-full flex items-center justify-center text-[#111111] hover:text-[#FF4D00] transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.97] border border-[#D4D3CD] hover:border-[#FF4D00] bg-[#D6D5CF] mb-1"
        >
          <span className="text-[14px]">🌱</span>
        </a>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => {
                if (item.action) {
                  item.action();
                } else {
                  onSelectTab(item.id);
                }
              }}
              className={`group relative w-10 h-10 rounded-full flex items-center justify-center transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.97] border ${
                isActive
                  ? "bg-[#111111] text-[#ECEBE6] border-[#111111] shadow-sm"
                  : item.id === "byok" && byokActive
                  ? "bg-[#D6D5CF] text-[#FF4D00] border-[#FF4D00]"
                  : "border-transparent text-[#555555] hover:text-[#111111] hover:bg-[#D6D5CF] hover:border-[#D4D3CD]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center bg-[#FF4D00] text-[9px] font-bold text-white rounded-full font-mono shadow-xs">
                  {item.badge}
                </span>
              )}
              {/* Floating Hover Tooltip */}
              <div className="absolute left-12 px-2.5 py-1 bg-[#ECEBE6] text-[#111111] text-[11px] font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-140 shadow-xl z-50 border border-[#D4D3CD] rounded-md font-sans">
                {item.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Section: Session Delegation Policy, Wallet & Menu */}
      <div className="flex flex-col items-center gap-2 w-full px-2">
        {/* Session Delegation Policy Button / Pill */}
        <button
          type="button"
          onClick={onOpenSession}
          aria-label="Privy Session Delegation"
          className={`group relative w-10 h-10 rounded-full flex items-center justify-center transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.97] border ${
            sessionStatus === "Active / Delegated"
              ? "bg-[#D6D5CF] text-[#111111] border-[#FF4D00]"
              : sessionStatus === "Pending Authorization"
              ? "bg-[#D6D5CF] text-[#555555] border-[#D4D3CD]"
              : "bg-[#D6D5CF] text-[#888888] border-[#D4D3CD]"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          {/* Active status indicator dot */}
          <span
            className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
              sessionStatus === "Active / Delegated"
                ? "bg-[#FF4D00] blink-step"
                : sessionStatus === "Pending Authorization"
                ? "bg-[#888888]"
                : "bg-[#D4D3CD]"
            }`}
          />

          {/* Floating Hover Tooltip showing live session status & budget cap */}
          <div className="absolute left-12 px-3 py-1.5 bg-[#ECEBE6] text-[11px] font-mono whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-140 shadow-2xl z-50 flex items-center gap-2 border border-[#D4D3CD] rounded-md">
            <span
              className={`w-1.5 h-1.5 shrink-0 rounded-full ${
                sessionStatus === "Active / Delegated"
                  ? "bg-[#FF4D00]"
                  : sessionStatus === "Pending Authorization"
                  ? "bg-[#888888]"
                  : "bg-[#D4D3CD]"
              }`}
            />
            <div className="flex flex-col text-left font-sans">
              <span className="font-semibold text-[#111111]">
                Session Policy: ${sessionCapUSDC} Cap
              </span>
              <span className="text-[10px] text-[#555555]">
                {sessionStatus} · Click to manage
              </span>
            </div>
          </div>
        </button>

        {/* Wallet / Treasury Button with Active Status on Hover */}
        <button
          type="button"
          onClick={onConnectWallet}
          aria-label="Treasury Wallet"
          className={`group relative w-10 h-10 rounded-full flex items-center justify-center transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.97] border ${
            isWalletConnected || walletAddress
              ? "bg-[#D6D5CF] text-[#111111] border-[#D4D3CD]"
              : "text-[#555555] hover:text-[#111111] hover:bg-[#D6D5CF] border-transparent"
          }`}
        >
          <Wallet className="w-4 h-4" />
          {/* Active indicator dot */}
          {(isWalletConnected || walletAddress) && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF4D00] blink-step rounded-full" />
          )}

          {/* Floating Hover Tooltip showing live active wallet & balance */}
          <div className="absolute left-12 px-3 py-1.5 bg-[#ECEBE6] text-[11px] font-mono whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-140 shadow-2xl z-50 flex items-center gap-2 border border-[#D4D3CD] rounded-md">
            <span className="w-1.5 h-1.5 bg-[#FF4D00] shrink-0 rounded-full" />
            <div className="flex flex-col text-left font-sans">
              <span className="font-semibold text-[#111111]">
                {isWalletConnected ? "Privy Smart Wallet Active" : "Arc Protocol Treasury Active"}
              </span>
              <span className="text-[10px] text-[#555555] font-mono">
                {shortAddress} {treasuryBalance ? `· ${treasuryBalance} USDC` : ""}
              </span>
            </div>
          </div>
        </button>

        {/* Copy Wallet Address (full address to clipboard; wallet button itself stays login/logout) */}
        {walletAddress && (
          <button
            type="button"
            onClick={handleCopyAddress}
            aria-label="Copy wallet address"
            className="group relative w-10 h-10 rounded-full flex items-center justify-center text-[#555555] hover:text-[#111111] hover:bg-[#D6D5CF] active:scale-[0.97] transition-[transform,colors] duration-140 cursor-pointer border border-transparent hover:border-[#D4D3CD]"
          >
            {addressCopied ? (
              <Check className="w-4 h-4 text-[#1E6B37]" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <div className="absolute left-12 px-2.5 py-1 bg-[#ECEBE6] text-[#111111] text-[11px] font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-140 shadow-xl z-50 border border-[#D4D3CD] rounded-md font-mono">
              {addressCopied ? "Copied!" : `Copy ${shortAddress}`}
            </div>
          </button>
        )}

        {/* Menu / Collapse */}
        <button
          type="button"
          aria-label="Expand Navigation"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#555555] hover:text-[#111111] hover:bg-[#D6D5CF] active:scale-[0.97] transition-[transform,colors] duration-140 cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
