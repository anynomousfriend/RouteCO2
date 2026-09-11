"use client";

import React from "react";
import { Toaster } from "sonner";

/**
 * SonnerToaster
 * Configured for RouteCO2:
 * 1. Text is fully selectable and copyable (select-text cursor-default).
 * 2. Dedicated tactile close button (closeButton={true}).
 * 3. Never auto-dismisses on click or text selection drag.
 * 4. Pauses on hover so transaction hashes, blocks, and error details can be copied safely.
 */
export function SonnerToaster() {
  return (
    <Toaster
      position="bottom-right"
      theme="light"
      closeButton
      duration={8000}
      toastOptions={{
        className:
          "!bg-[#ECEBE6] !border !border-[#D4D3CD] !text-[#111111] !shadow-xl !rounded-xl font-sans !cursor-default select-text selection:!bg-[#FF4D00] selection:!text-[#FFFFFF] transition-[transform,box-shadow] duration-150",
        classNames: {
          closeButton:
            "!bg-[#D6D5CF] !border !border-[#D4D3CD] hover:!bg-[#111111] hover:!text-[#ECEBE6] active:!scale-90 !text-[#555555] !transition-[background-color,color,transform] !duration-150 !cursor-pointer",
          title: "select-text font-medium",
          description: "select-text text-[#555555]",
        },
      }}
    />
  );
}
