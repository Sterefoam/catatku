"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage, apiGet, apiPost } from "@/lib/client-api";
import type { SymbolSearchResult } from "@/lib/trading/types";

interface SearchResponse {
  results: SymbolSearchResult[];
}

/**
 * Kotak cari simbol saham dengan aksi cepat: lihat inspeksi / tambah watchlist.
 * Dipakai di dashboard Meja Trading.
 */
export function QuickSymbolSearch({ placeholder = "Cari simbol, mis. TSLA" }: { placeholder?: string }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SymbolSearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [adding, setAdding] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet<SearchResponse>(
          `/api/trading/search?q=${encodeURIComponent(term)}`,
        );
        if (!cancelled) {
          setResults(data.results);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function addToWatchlist(symbol: string, name: string) {
    setAdding(symbol);
    try {
      await apiPost("/api/trading/watchlist", { symbol, name });
      toast.success(`${symbol} masuk daftar pantau.`);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="pl-11"
          aria-label="Cari simbol saham"
          autoComplete="off"
          spellCheck={false}
        />
        {searching ? (
          <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {error ? <p className="px-1 text-[12px] text-danger">{error}</p> : null}

      {query.trim() && !searching && !results.length && !error ? (
        <p className="px-1 text-[12px] text-muted-foreground">
          Simbol tidak ditemukan. Coba kode lain (mis. NVDA, AMD, AAPL).
        </p>
      ) : null}

      {results.length ? (
        <ul className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          {results.map((row) => (
            <li
              key={row.symbol}
              className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5 last:border-b-0"
            >
              <Link
                href={`/trading/inspeksi/${row.symbol}`}
                className="min-w-0 flex-1 rounded-lg px-1 py-0.5"
              >
                <p className="text-[13.5px] font-bold">{row.symbol}</p>
                <p className="truncate text-[11.5px] text-muted-foreground">{row.name}</p>
              </Link>
              <Button
                size="sm"
                variant="soft"
                className="h-8 shrink-0 px-2.5 text-[12px]"
                disabled={adding === row.symbol}
                onClick={() => addToWatchlist(row.symbol, row.name)}
              >
                {adding === row.symbol ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Daftar pantau
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
