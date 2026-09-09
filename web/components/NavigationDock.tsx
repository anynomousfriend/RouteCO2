"use client";

import React from "react";
import {
  Plane,
  Calendar,
  ShieldCheck,
  Layers,
  Wallet,
  Menu,
  KeyRound,
  Clock,
} from "lucide-react";

interface NavigationDockProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAudit: () => void;
  onOpenAqua: () => void;
  onOpenSession: () => void;
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
  ];

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "";

  return (
    <aside className="w-14 h-full bg-[#FAFAFA] border-r border-black/[0.08] flex flex-col items-center justify-between py-3 shrink-0 select-none z-20">
      {/* Top Section: Navigation Items */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2">
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
              className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.92] ${
                isActive
                  ? "bg-black text-white shadow-xs"
                  : "text-neutral-500 hover:text-black hover:bg-black/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black font-mono shadow-xs">
                  {item.badge}
                </span>
              )}
              {/* Floating Hover Tooltip */}
              <div className="absolute left-12 px-2.5 py-1 rounded-lg bg-neutral-900 text-white text-[11px] font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-140 shadow-xl z-50">
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
          className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.92] ${
            sessionStatus === "Active / Delegated"
              ? "bg-purple-50 text-purple-700 border border-purple-300/80 shadow-2xs hover:bg-purple-100/70"
              : sessionStatus === "Pending Authorization"
              ? "bg-amber-50 text-amber-700 border border-amber-300/80 hover:bg-amber-100/70"
              : "bg-rose-50 text-rose-700 border border-rose-300/80 hover:bg-rose-100/70"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          {/* Active status indicator dot */}
          <span
            className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white ${
              sessionStatus === "Active / Delegated"
                ? "bg-purple-500 animate-pulse"
                : sessionStatus === "Pending Authorization"
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
          />

          {/* Floating Hover Tooltip showing live session status & budget cap */}
          <div className="absolute left-12 px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-[11px] font-mono whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-140 shadow-2xl z-50 flex items-center gap-2 border border-white/10">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                sessionStatus === "Active / Delegated"
                  ? "bg-purple-400"
                  : sessionStatus === "Pending Authorization"
                  ? "bg-amber-400"
                  : "bg-rose-400"
              }`}
            />
            <div className="flex flex-col text-left">
              <span className="font-semibold text-purple-300">
                Session Policy: ${sessionCapUSDC} Cap
              </span>
              <span className="text-[10px] text-neutral-300">
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
          className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.92] ${
            isWalletConnected || walletAddress
              ? "bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs hover:bg-emerald-100/70"
              : "text-neutral-500 hover:text-black hover:bg-black/5"
          }`}
        >
          <Wallet className="w-4 h-4" />
          {/* Active indicator dot */}
          {(isWalletConnected || walletAddress) && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
          )}

          {/* Floating Hover Tooltip showing live active wallet & balance */}
          <div className="absolute left-12 px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-[11px] font-mono whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-140 shadow-2xl z-50 flex items-center gap-2 border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="font-semibold text-emerald-400">
                {isWalletConnected ? "Privy Smart Wallet Active" : "Arc Protocol Treasury Active"}
              </span>
              <span className="text-[10px] text-neutral-300">
                {shortAddress} {treasuryBalance ? `· ${treasuryBalance} USDC` : ""}
              </span>
            </div>
          </div>
        </button>

        {/* Menu / Collapse */}
        <button
          type="button"
          aria-label="Expand Navigation"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-400 hover:text-black hover:bg-black/5 active:scale-[0.92] transition-transform duration-140 cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
