/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Slim barrel imports (lucide-react etc.) so shared chunks stay small.
    optimizePackageImports: ["lucide-react", "sonner"],
  },
};

export default nextConfig;
