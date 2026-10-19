import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module: keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3"],
  // Monorepo/lockfile tetangga bisa membingungkan Next saat menentukan root.
  outputFileTracingRoot: process.cwd(),
  // Badge dev Next tidak perlu muncul di screenshot/preview.
  devIndicators: false,
  experimental: {
    // Keep payloads small — we ship a handful of small client components.
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
