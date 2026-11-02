"use client";

/**
 * Kotak cari simbol untuk halaman /trading/inspeksi.
 * Debounce 300ms ke /api/trading/search, klik hasil -> halaman inspeksi.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiErrorMessage, apiGet } from "@/lib/client-api";
import type { SymbolSearchResult } from "@/lib/trading/types";

interface SearchResponse {
  results: SymbolSearchResult[];
}

const SYMBOL_RE = /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/;

export function SymbolSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SymbolSearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet<SearchResponse>(
          `/api/trading/search?q=${encodeURIComponent(term)}`,
        );
        if (cancelled) return;
        setResults(data.results);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function openSymbol(symbol: string) {
    router.push(`/trading/inspeksi/${encodeURIComponent(symbol)}`);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    const first = results[0];
    if (first) {
      openSymbol(first.symbol);
      return;
    }
    if (SYMBOL_RE.test(term)) openSymbol(term.toUpperCase());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" role="search">
      <label
        htmlFor="inspector-symbol"
        className="block px-1 text-[13px] font-semibold text-muted-foreground"
      >
        Cari saham
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="inspector-symbol"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kode atau nama, mis. TSLA / Tesla"
          className="h-12 pl-11 pr-11"
          aria-label="Cari simbol saham"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        {searching ? (
          <Loader2
            className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {error ? <p className="px-1 text-[12px] text-danger">{error}</p> : null}

      {query.trim() && !searching && !results.length && !error ? (
        <p className="px-1 text-[12px] text-muted-foreground">
          Simbol tidak ditemukan. Coba kode lain, mis. NVDA, AMD, AAPL.
        </p>
      ) : null}

      {results.length ? (
        <ul className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          {results.map((row) => (
            <li key={row.symbol} className="border-b border-border/60 last:border-b-0">
              <Link
                href={`/trading/inspeksi/${encodeURIComponent(row.symbol)}`}
                className="flex min-h-11 items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-bold">{row.symbol}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {row.name}
                  </span>
                </span>
                <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {row.exchange}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Tekan Enter untuk membuka hasil teratas. Data pencarian dari Yahoo Finance (gratis, bisa
        tertunda).
      </p>
    </form>
  );
}
