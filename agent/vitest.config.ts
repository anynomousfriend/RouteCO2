import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    testTimeout: 30000, // 30s for live network calls (OpenSky Network & Arc RPC)
    hookTimeout: 30000,
  },
});
