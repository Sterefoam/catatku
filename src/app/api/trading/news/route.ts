import { jsonOk, requireApiUser } from "@/lib/api";
import {
  DEFAULT_NEWS_HOURS,
  getTradingNews,
  sanitizeNewsSymbols,
} from "@/lib/trading/news";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 60;

/**
 * GET /api/trading/news?symbols=TSLA,NVDA&hours=48
 * Headline Yahoo Finance + filing 8-K SEC untuk simbol yang diminta.
 */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const rawSymbols = url.searchParams.get("symbols") ?? "";
  const symbols = sanitizeNewsSymbols(rawSymbols.split(","));
  if (!symbols.length) return jsonOk({ items: [] });

  const hoursParam = Number.parseInt(url.searchParams.get("hours") ?? "", 10);
  const hours = Number.isFinite(hoursParam)
    ? Math.min(168, Math.max(1, hoursParam))
    : DEFAULT_NEWS_HOURS;

  const items = await getTradingNews(symbols, hours).catch(() => []);
  return jsonOk({ items });
}
