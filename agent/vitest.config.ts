import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 20000, // 20s for live network calls (OpenSky Network & Arc RPC)
    hookTimeout: 20000,
  },
});
