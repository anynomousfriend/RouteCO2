"use client";

import React, { useState } from "react";
import {
  X,
  FlaskConical,
  KeyRound,
  AlertTriangle,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { Address } from "viem";
import { deriveByokAddress } from "@/lib/byok-settler";
import { checkTreasuryFunds } from "@/lib/treasury-guard";

interface ByokPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeAddress: Address | null;
  onActivate: (privateKey: `0x${string}`) => void;
  onForget: () => void;
}

export function ByokPanel({ isOpen, onClose, activeAddress, onActivate, onForget }: ByokPanelProps) {
  const [keyInput, setKeyInput] = useState("");
  const [previewAddress, setPreviewAddress] = useState<Address | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Escape key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePreview = async () => {
    try {
      const addr = deriveByokAddress(keyInput);
      setPreviewAddress(addr);
      setBalance(null);
      setIsChecking(true);
      const res = await checkTreasuryFunds(addr, 0n);
      if (res.balanceMicro !== null) {
        setBalance((Number(res.balanceMicro) / 1e6).toFixed(2));
      } else {
        setBalance("unknown");
      }
    } catch (err) {
      setPreviewAddress(null);
      toast.error("Invalid Key", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleActivate = () => {
    try {
      const trimmed = keyInput.trim();
      const hex = (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as `0x${string}`;
      deriveByokAddress(hex); // validates
      onActivate(hex);
      setKeyInput("");
      setPreviewAddress(null);
      setBalance(null);
      toast.success("Test Key Active (Memory Only)", {
        description:
          "Settlements now sign locally in your browser. The key never leaves this device.",
        duration: 8000,
      });
    } catch (err) {
      toast.error("Invalid Key", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="byok-modal-title"
        className="relative w-full max-w-lg bg-[#272e33] shadow-2xl border border-dashed border-[#d3c6aa]/20 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dashed border-[#d3c6aa]/16 flex items-center justify-between bg-[#1e2528]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#7fbbb3] flex items-center justify-center text-[#1e2528]">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <h2 id="byok-modal-title" className="text-sm font-bold text-[#d3c6aa] font-mono">
                TEST IT YOURSELF (BYOK)
              </h2>
              <p className="text-[11px] text-[#859289] font-mono">
                Settle with your own Arc Testnet key — no signup, no server custody
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#9daaa4] font-mono">
          {/* Testnet-only warning */}
          <div className="p-3 bg-[#dbbc7f]/[0.08] border border-dashed border-[#dbbc7f]/40 text-[#dbbc7f] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="block">TESTNET ONLY — Arc Testnet (5042002).</strong>
              Never paste a key holding real funds. The key lives only in this tab's
              memory: it is never sent to any server, never logged, never stored.
              Closing the tab or clicking Forget destroys it.
            </div>
          </div>

          {activeAddress ? (
            <div className="p-3.5 bg-[#a7c080]/[0.08] border border-dashed border-[#a7c080]/40">
              <div className="flex items-center gap-2 text-[#a7c080] font-semibold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Test key active</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#d3c6aa] tabular-nums break-all">
                  {activeAddress}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyAddress(activeAddress)}
                  className="p-1.5 text-[#859289] hover:text-[#d3c6aa] cursor-pointer shrink-0"
                  title="Copy address (fund it from the Circle faucet)"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#a7c080]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10.5px] text-[#859289] mt-2 leading-relaxed">
                Fund this address with testnet USDC via{" "}
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#7fbbb3] underline inline-flex items-center gap-0.5"
                >
                  faucet.circle.com <ExternalLink className="w-3 h-3" />
                </a>{" "}
                — then every Settle button signs locally as both treasury and agent.
                Your flights settle permissionlessly; nothing touches the demo treasury.
              </p>
              <button
                type="button"
                onClick={() => {
                  onForget();
                  toast.info("Test Key Forgotten", {
                    description: "Key wiped from memory. Settlements revert to the demo treasury route.",
                  });
                }}
                className="mt-3 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#e67e80]/10 text-[#e67e80] hover:bg-[#e67e80]/20 border border-dashed border-[#e67e80]/40 cursor-pointer active:scale-[0.96] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Forget Key</span>
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#d3c6aa] uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  Arc Testnet Private Key
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value);
                    setPreviewAddress(null);
                    setBalance(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handlePreview();
                  }}
                  placeholder="0x… (64 hex characters)"
                  className="w-full px-3 py-2.5 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16 text-xs font-mono text-[#d3c6aa] placeholder-[#859289]/60 focus:outline-none focus:border-[#7fbbb3]/60 transition-colors tabular-nums"
                />
                <p className="text-[10.5px] text-[#859289]">
                  Paste to preview the address and balance first — activation is a separate step.
                </p>
              </div>

              {previewAddress && (
                <div className="p-3 bg-[#1e2528] border border-dashed border-[#d3c6aa]/16">
                  <div className="text-[10px] text-[#859289] uppercase">Derived address</div>
                  <div className="text-[11px] text-[#d3c6aa] tabular-nums break-all mt-0.5">
                    {previewAddress}
                  </div>
                  <div className="text-[11px] text-[#859289] mt-1">
                    USDC balance:{" "}
                    <strong className="text-[#d3c6aa]">
                      {isChecking ? "checking…" : balance === null ? "—" : `${balance}`}
                    </strong>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="flex-1 py-2.5 px-4 bg-[#1e2528] hover:bg-[#2d353b] text-xs text-[#9daaa4] hover:text-[#d3c6aa] border border-dashed border-[#d3c6aa]/16 cursor-pointer transition-colors font-mono font-semibold"
                >
                  Preview Address
                </button>
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={!keyInput.trim()}
                  className="flex-1 py-2.5 px-4 bg-[#7fbbb3] hover:bg-[#a7c080] disabled:opacity-40 text-xs text-[#1e2528] font-bold cursor-pointer transition-colors font-mono"
                >
                  Use This Key
                </button>
              </div>
            </>
          )}

          <div className="text-[10.5px] text-[#859289] leading-relaxed border-t border-dashed border-[#d3c6aa]/16 pt-3">
            How self-testing works: your key registers its own flight (treasury = you),
            ships its own Aqua strategy, approves its own USDC, and settles — all signed
            in-browser. The vault's registrar rule lets anyone settle flights they
            registered; owner-authorized agents are unaffected.
          </div>
        </div>
      </div>
    </div>
  );
}
