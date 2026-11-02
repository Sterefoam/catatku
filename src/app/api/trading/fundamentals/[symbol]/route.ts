import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { getFundamentals } from "@/lib/trading/sec";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 60;

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

/**
 * GET /api/trading/fundamentals/[symbol]
 * Ringkasan XBRL SEC (4 kuartal + 1 tahun + TTM + YoY) & 8 filing terbaru.
 * Bila simbol tidak ada di SEC, tetap 200 dengan catatan "tidak tersedia".
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { symbol: rawSymbol } = await params;
  let decoded = rawSymbol ?? "";
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Biarkan apa adanya; validasi regex di bawah yang menentukan.
  }
  const symbol = decoded.trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) {
    return jsonError("Simbol tidak valid (contoh: TSLA, NVDA).", 404);
  }

  const result = await getFundamentals(symbol);
  return jsonOk({
    fundamentals: result.fundamentals,
    filings: result.filings,
  });
}
