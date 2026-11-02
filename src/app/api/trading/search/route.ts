import { jsonOk, requireApiUser } from "@/lib/api";
import { searchSymbols } from "@/lib/trading/yahoo";
import { UNIVERSE_SP100 } from "@/lib/trading/universe";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 30;

/** GET /api/trading/search?q=apple — cari simbol saham AS. */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (!query) return jsonOk({ results: [] });

  let results = await searchSymbols(query).catch(() => []);
  if (!results.length) {
    const needle = query.toLowerCase();
    results = UNIVERSE_SP100.filter(
      (row) =>
        row.symbol.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle),
    )
      .slice(0, 8)
      .map((row) => ({ symbol: row.symbol, name: row.name, exchange: "US" }));
  }

  return jsonOk({ results });
}
