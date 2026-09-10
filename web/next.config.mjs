import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // See lib/cesium-spz-stub.js for the full explanation.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@spz-loader/core": path.join(__dirname, "lib", "cesium-spz-stub.js"),
    };
    return config;
  },
};

export default nextConfig;
