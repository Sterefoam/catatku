import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL punya binding native untuk mode file lokal; jangan di-bundle webpack.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // File migrasi SQL dibaca saat runtime (auto-migrate) — ikutkan ke output Vercel.
  outputFileTracingIncludes: {
    "/**/*": ["./drizzle/**/*"],
  },
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
