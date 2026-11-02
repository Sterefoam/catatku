import { jsonError, jsonOk, numberParam, requireApiUser } from "@/lib/api";
import { SCAN_MAX_SYMBOLS, scanStocks } from "@/lib/trading/scan";
import type { ScanMode } from "@/lib/trading/types";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 60;

/**
 * GET /api/trading/scan
 * Query: mode=daily|orb, universe=sp100|mega|watchlist|symbols,
 *        symbols=TSLA,NVDA, limit=1..100 (default 100).
 */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const modeParam = (url.searchParams.get("mode") ?? "daily").trim().toLowerCase();
  const mode: ScanMode = modeParam === "orb" ? "orb" : "daily";
  const universe = (url.searchParams.get("universe") ?? "sp100").trim().toLowerCase();
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);
  const limit = Math.min(
    SCAN_MAX_SYMBOLS,
    Math.max(1, numberParam(url.searchParams.get("limit"), SCAN_MAX_SYMBOLS)),
  );

  try {
    const scan = await scanStocks({
      mode,
      universe,
      symbols,
      limit,
      userId: auth.user.id,
    });
    return jsonOk({ scan });
  } catch (error) {
    console.error("[api/trading/scan]", error);
    return jsonError("Pemindaian gagal dijalankan. Coba lagi sebentar.", 500);
  }
}
