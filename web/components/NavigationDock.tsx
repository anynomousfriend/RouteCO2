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
    <aside className="w-14 h-full bg-[#272e33] border-r border-dashed border-[#d3c6aa]/16 flex flex-col items-center justify-between py-3 shrink-0 select-none z-20">
      {/* Top Section: Navigation Items */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2">
        <a
          href="/"
          title="Return to Protocol Overview & Judge Specs"
          className="group relative w-10 h-10 flex items-center justify-center text-[#859289] hover:text-[#a7c080] transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.92] border border-dashed border-[#d3c6aa]/16 hover:border-[#a7c080]/50 bg-[#2d353b] mb-1"
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
              className={`group relative w-10 h-10 flex items-center justify-center transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.92] ${
                isActive
                  ? "bg-[#a7c080] text-[#2d353b]"
                  : "text-[#859289] hover:text-[#d3c6aa] hover:bg-[#d3c6aa]/[0.06]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center bg-[#dbbc7f] text-[9px] font-bold text-[#2d353b] font-mono shadow-xs">
                  {item.badge}
                </span>
              )}
              {/* Floating Hover Tooltip */}
              <div className="absolute left-12 px-2.5 py-1 bg-[#1e2528] text-[#d3c6aa] text-[11px] font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-140 shadow-xl z-50 border border-dashed border-[#d3c6aa]/16">
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
          className={`group relative w-10 h-10 flex items-center justify-center transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.92] border ${
            sessionStatus === "Active / Delegated"
              ? "bg-[#a7c080]/10 text-[#a7c080] border-dashed border-[#a7c080]/50"
              : sessionStatus === "Pending Authorization"
              ? "bg-[#dbbc7f]/10 text-[#dbbc7f] border-dashed border-[#dbbc7f]/50"
              : "bg-[#e67e80]/10 text-[#e67e80] border-dashed border-[#e67e80]/50"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          {/* Active status indicator dot */}
          <span
            className={`absolute top-1.5 right-1.5 w-2 h-2 ${
              sessionStatus === "Active / Delegated"
                ? "bg-[#a7c080] blink-step"
                : sessionStatus === "Pending Authorization"
                ? "bg-[#dbbc7f]"
                : "bg-[#e67e80]"
            }`}
          />

          {/* Floating Hover Tooltip showing live session status & budget cap */}
          <div className="absolute left-12 px-3 py-1.5 bg-[#1e2528] text-[11px] font-mono whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-140 shadow-2xl z-50 flex items-center gap-2 border border-dashed border-[#d3c6aa]/16">
            <span
              className={`w-1.5 h-1.5 shrink-0 ${
                sessionStatus === "Active / Delegated"
                  ? "bg-[#a7c080]"
                  : sessionStatus === "Pending Authorization"
                  ? "bg-[#dbbc7f]"
                  : "bg-[#e67e80]"
              }`}
            />
            <div className="flex flex-col text-left">
              <span className="font-semibold text-[#a7c080]">
                Session Policy: ${sessionCapUSDC} Cap
              </span>
              <span className="text-[10px] text-[#859289]">
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
          className={`group relative w-10 h-10 flex items-center justify-center transition-[transform,colors] duration-140 cursor-pointer active:scale-[0.92] ${
            isWalletConnected || walletAddress
              ? "bg-[#7fbbb3]/10 text-[#7fbbb3] border border-dashed border-[#7fbbb3]/50"
              : "text-[#859289] hover:text-[#d3c6aa] hover:bg-[#d3c6aa]/[0.06]"
          }`}
        >
          <Wallet className="w-4 h-4" />
          {/* Active indicator dot */}
          {(isWalletConnected || walletAddress) && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#7fbbb3] blink-step" />
          )}

          {/* Floating Hover Tooltip showing live active wallet & balance */}
          <div className="absolute left-12 px-3 py-1.5 bg-[#1e2528] text-[11px] font-mono whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-140 shadow-2xl z-50 flex items-center gap-2 border border-dashed border-[#d3c6aa]/16">
            <span className="w-1.5 h-1.5 bg-[#7fbbb3] shrink-0" />
            <div className="flex flex-col text-left">
              <span className="font-semibold text-[#7fbbb3]">
                {isWalletConnected ? "Privy Smart Wallet Active" : "Arc Protocol Treasury Active"}
              </span>
              <span className="text-[10px] text-[#859289]">
                {shortAddress} {treasuryBalance ? `· ${treasuryBalance} USDC` : ""}
              </span>
            </div>
          </div>
        </button>

        {/* Menu / Collapse */}
        <button
          type="button"
          aria-label="Expand Navigation"
          className="w-10 h-10 flex items-center justify-center text-[#859289] hover:text-[#d3c6aa] hover:bg-[#d3c6aa]/[0.06] active:scale-[0.92] transition-[transform,colors] duration-140 cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
