"use client";

import dynamic from "next/dynamic";

/**
 * Agentation panel is dev-only. Kept in its own ssr:false chunk so a slow or
 * unreachable annotation backend can never block/trip the root layout chunk.
 */
const Agentation = dynamic(
  () => import("agentation").then((mod) => ({ default: mod.Agentation })),
  { ssr: false }
);

export function AgentationToolbar() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NEXT_PUBLIC_ENABLE_AGENTATION !== "true"
  ) {
    return null;
  }
  return <Agentation endpoint="http://localhost:4747" />;
}
