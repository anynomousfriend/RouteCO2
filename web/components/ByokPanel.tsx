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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="byok-modal-title"
        className="relative w-full max-w-lg bg-[#ECEBE6] text-[#111111] rounded-xl shadow-2xl border border-[#D4D3CD] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 font-sans"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#D4D3CD] flex items-center justify-between bg-[#D6D5CF]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#111111] flex items-center justify-center text-[#ECEBE6]">
              <FlaskConical className="w-4 h-4 text-[#FF4D00]" />
            </div>
            <div>
              <h2 id="byok-modal-title" className="text-sm font-bold text-[#111111] font-sans">
                TEST IT YOURSELF (BYOK)
              </h2>
              <p className="text-[11px] text-[#555555] font-sans">
                Settle with your own Arc Testnet key: no signup, no server custody
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#111111] font-sans">
          {/* Testnet-only warning */}
          <div className="p-3 rounded-lg bg-[#D6D5CF] border border-[#D4D3CD] text-[#111111] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#FF4D00] shrink-0 mt-0.5" />
            <div className="text-[11px] text-[#555555] leading-relaxed">
              <strong className="block text-[#111111]">TESTNET ONLY: Arc Testnet (5042002).</strong>
              Never paste a key holding real funds. The key lives only in this tab's
              memory: it is never sent to any server, never logged, never stored.
              Closing the tab or clicking Forget destroys it.
            </div>
          </div>

          {activeAddress ? (
            <div className="p-3.5 rounded-lg bg-[#D6D5CF] border border-[#D4D3CD]">
              <div className="flex items-center gap-2 text-[#111111] font-semibold text-xs">
                <ShieldCheck className="w-4 h-4 text-[#FF4D00]" />
                <span>Test key active</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#111111] font-mono tabular-nums break-all">
                  {activeAddress}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyAddress(activeAddress)}
                  className="icon-circle p-1.5 text-[#555555] hover:text-[#111111] cursor-pointer shrink-0"
                  title="Copy address (fund it from the Circle faucet)"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#FF4D00]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10.5px] text-[#555555] mt-2 leading-relaxed font-sans">
                Fund this address with testnet USDC via{" "}
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#111111] font-medium underline inline-flex items-center gap-0.5 hover:text-[#FF4D00]"
                >
                  faucet.circle.com <ExternalLink className="w-3 h-3" />
                </a>{": "}
                then every Settle button signs locally as both treasury and agent.
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
                className="btn-pill mt-3 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#ECEBE6] text-[#111111] hover:text-[#FF4D00] border border-[#D4D3CD] hover:border-[#FF4D00] cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#FF4D00]" />
                <span>Forget Key</span>
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#111111] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <KeyRound className="w-3.5 h-3.5 text-[#FF4D00]" />
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
                  className="w-full px-3 py-2.5 bg-[#ECEBE6] rounded-lg border border-[#D4D3CD] text-xs font-mono text-[#111111] placeholder-[#555555]/60 focus:outline-none focus:border-[#FF4D00] transition-colors tabular-nums"
                />
                <p className="text-[10.5px] text-[#555555] font-sans">
                  Paste to preview the address and balance first: activation is a separate step.
                </p>
              </div>

              {previewAddress && (
                <div className="p-3 rounded-lg bg-[#D6D5CF] border border-[#D4D3CD]">
                  <div className="text-[10px] text-[#555555] uppercase font-mono">Derived address</div>
                  <div className="text-[11px] text-[#111111] font-mono tabular-nums break-all mt-0.5">
                    {previewAddress}
                  </div>
                  <div className="text-[11px] text-[#555555] mt-1 font-sans">
                    USDC balance:{" "}
                    <strong className="text-[#111111] font-mono">
                      {isChecking ? "checking…" : balance === null ? "--" : `${balance}`}
                    </strong>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="btn-pill flex-1 py-2.5 px-4 bg-[#ECEBE6] hover:bg-[#D6D5CF] text-xs text-[#111111] border border-[#D4D3CD] cursor-pointer transition-colors font-sans font-semibold"
                >
                  Preview Address
                </button>
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={!keyInput.trim()}
                  className="btn-pill flex-1 py-2.5 px-4 bg-[#111111] hover:bg-[#FF4D00] disabled:opacity-40 text-xs text-[#ECEBE6] font-bold cursor-pointer transition-colors font-sans"
                >
                  Use This Key
                </button>
              </div>
            </>
          )}

          <div className="text-[10.5px] text-[#555555] leading-relaxed border-t border-[#D4D3CD] pt-3 font-sans">
            How self-testing works: your key registers its own flight (treasury = you),
            ships its own Aqua strategy, approves its own USDC, and settles, all signed
            in-browser. The vault's registrar rule lets anyone settle flights they
            registered; owner-authorized agents are unaffected.
          </div>
        </div>
      </div>
    </div>
  );
}
