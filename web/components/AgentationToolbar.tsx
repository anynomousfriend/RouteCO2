"use client";

import dynamic from "next/dynamic";

const Agentation =
  process.env.NEXT_PUBLIC_ENABLE_AGENTATION === "true"
    ? dynamic(() => import("agentation").then((mod) => mod.Agentation), { ssr: false })
    : () => null;

export function AgentationToolbar() {
  if (process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_ENABLE_AGENTATION !== "true") {
    return null;
  }
  return <Agentation endpoint="http://localhost:4747" />;
}
