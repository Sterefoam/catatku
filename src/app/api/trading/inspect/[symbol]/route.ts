import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { buildRiskNotes } from "@/components/trading/inspector/risk-notes";
import { analyze } from "@/lib/trading/technicals";
import type { InspectDTO } from "@/lib/trading/types";
import { fetchChart, fetchQuote } from "@/lib/trading/yahoo";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 60;

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

/**
 * GET /api/trading/inspect/[symbol]
 * Laporan inspeksi satu saham: harga, teknikal, setup, grafik harian & intraday.
 * Data gratis (Yahoo Finance) bisa tertunda — bukan real time.
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

  const [quote, daily, intraday] = await Promise.all([
    fetchQuote(symbol).catch(() => null),
    fetchChart(symbol, "3mo", "1d").catch(() => null),
    fetchChart(symbol, "1d", "5m").catch(() => null),
  ]);

  if (!quote) {
    return jsonError(
      `Data ${symbol} tidak ditemukan di Yahoo Finance. Periksa kode simbol (contoh: TSLA, NVDA).`,
      404,
    );
  }
  if (!daily || daily.bars.length < 2) {
    return jsonError(`Grafik harian ${symbol} sedang tidak tersedia. Coba lagi sebentar.`, 502);
  }

  const analysis = analyze({ symbol, daily, intraday, quote });
  const inspect: InspectDTO = {
    symbol,
    name: quote.name || symbol,
    quote,
    technicals: analysis.technicals,
    setups: analysis.setups,
    daily,
    intraday,
    // Kalender earnings berbayar; jangan mengarang sehingga dibiarkan null.
    earningsDate: null,
    riskNotes: buildRiskNotes(quote, analysis.technicals),
    asOf: quote.asOf,
  };

  return jsonOk({ inspect });
}
