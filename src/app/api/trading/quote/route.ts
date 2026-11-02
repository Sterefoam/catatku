import { jsonOk, requireApiUser } from "@/lib/api";
import { fetchQuotes } from "@/lib/trading/yahoo";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 30;

/** GET /api/trading/quote?symbols=TSLA,NVDA — harga terakhir (sen). */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const raw = url.searchParams.get("symbols") ?? "";
  const symbols = raw
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol))
    .slice(0, 20);

  if (!symbols.length) return jsonOk({ quotes: [] });

  const map = await fetchQuotes(symbols).catch(() => new Map());
  const quotes = symbols
    .map((symbol) => map.get(symbol))
    .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote));

  return jsonOk({ quotes });
}
