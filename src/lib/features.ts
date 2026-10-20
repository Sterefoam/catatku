/**
 * Fitur yang hanya boleh aktif di pengembangan lokal.
 * Demo login otomatis mati saat NODE_ENV=production (mis. di Vercel),
 * kecuali sengaja diaktifkan lewat ENABLE_DEMO_LOGIN=1.
 */
export function isDemoLoginEnabled(): boolean {
  if (process.env.ENABLE_DEMO_LOGIN === "1") return true;
  if (process.env.ENABLE_DEMO_LOGIN === "0") return false;
  return process.env.NODE_ENV !== "production";
}
