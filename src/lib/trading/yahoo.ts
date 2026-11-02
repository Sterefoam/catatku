/**
 * Klien data pasar gratis (Yahoo Finance chart/spark/search).
 *
 * - Server-side saja (route handler / server component).
 * - Data gratis, tidak resmi, biasanya tertunda 1–15 menit. Tidak pernah
 *   disebut "real time" di UI.
 * - Semua harga dikembalikan dalam SEN (integer) lewat helper di file ini.
 * - Cache in-memory ber-TTL supaya halaman cepat dan tidak membanjiri Yahoo.
 */

import type { Bar, CandleSeries, ChartInterval, Quote, SymbolSearchResult } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const HOSTS = ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"];

interface CacheEntry {
  expires: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();

export const QUOTE_TTL_MS = 15_000;
export const INTRADAY_TTL_MS = 30_000;
export const DAILY_TTL_MS = 5 * 60_000;
export const SEARCH_TTL_MS = 60 * 60_000;

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown, ttlMs: number): void {
  if (cache.size > 600) {
    const now = Date.now();
    for (const [entryKey, entry] of cache) {
      if (entry.expires < now) cache.delete(entryKey);
    }
  }
  cache.set(key, { expires: Date.now() + ttlMs, value });
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await loader();
  cacheSet(key, value, ttlMs);
  return value;
}

async function fetchJson<T>(path: string, timeoutMs = 9000): Promise<T> {
  let lastError: unknown = null;
  for (const host of HOSTS) {
    try {
      const response = await fetch(`${host}${path}`, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        lastError = new Error(`Yahoo ${response.status}`);
        continue;
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gagal menghubungi Yahoo Finance");
}

export function toCents(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function fromCents(value: number): number {
  return value / 100;
}

/** Batasi konkurensi permintaan HTTP. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as T, index);
    }
  });
  await Promise.all(runners);
  return results;
}

interface YahooChartResult {
  meta?: Record<string, unknown>;
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
}

interface YahooChartResponse {
  chart?: { result?: YahooChartResult[]; error?: { description?: string } | null };
}

type Range = "1d" | "5d" | "1mo" | "3mo" | "60d" | "6mo" | "1y" | "2y";

function seriesFromResult(symbol: string, range: string, interval: ChartInterval, result: YahooChartResult): CandleSeries | null {
  const quote = result.indicators?.quote?.[0];
  const stamps = result.timestamp ?? [];
  if (!quote || !stamps.length) return null;

  const bars: Bar[] = [];
  for (let i = 0; i < stamps.length; i += 1) {
    const close = quote.close?.[i];
    if (typeof close !== "number" || !Number.isFinite(close)) continue;
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    if (
      typeof open !== "number" ||
      typeof high !== "number" ||
      typeof low !== "number" ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low)
    ) {
      continue;
    }
    bars.push({
      t: stamps[i] as number,
      o: toCents(open),
      h: toCents(high),
      l: toCents(low),
      c: toCents(close),
      v: Math.round(quote.volume?.[i] ?? 0),
    });
  }
  if (!bars.length) return null;

  const meta = result.meta ?? {};
  const prevClose = toCents(
    meta["chartPreviousClose"] ?? meta["previousClose"] ?? (bars[0] as Bar).o,
  );
  const asOf =
    typeof meta["regularMarketTime"] === "number"
      ? new Date((meta["regularMarketTime"] as number) * 1000).toISOString()
      : new Date((bars[bars.length - 1] as Bar).t * 1000).toISOString();

  return { symbol, interval, range, bars, prevClose, asOf };
}

/** Ambil satu seri chart (1d/5m, 3mo/1d, dst). */
export async function fetchChart(
  symbol: string,
  range: Range = "3mo",
  interval: ChartInterval = "1d",
): Promise<CandleSeries | null> {
  const clean = symbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(clean)) return null;
  const ttl = interval === "1d" ? DAILY_TTL_MS : INTRADAY_TTL_MS;
  return cached(`chart:${clean}:${range}:${interval}`, ttl, async () => {
    const params = new URLSearchParams({
      range,
      interval,
      includePrePost: "false",
      events: "div,split",
    });
    const payload = await fetchJson<YahooChartResponse>(
      `/v8/finance/chart/${encodeURIComponent(clean)}?${params.toString()}`,
    );
    const result = payload.chart?.result?.[0];
    if (!result) return null;
    return seriesFromResult(clean, range, interval, result);
  });
}

function quoteFromMeta(symbol: string, meta: Record<string, unknown>): Quote {
  const price = toCents(meta["regularMarketPrice"] ?? meta["previousClose"]);
  const prevClose = toCents(meta["chartPreviousClose"] ?? meta["previousClose"] ?? price / 100);
  const change = price - prevClose;
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
  const asOf =
    typeof meta["regularMarketTime"] === "number"
      ? new Date((meta["regularMarketTime"] as number) * 1000).toISOString()
      : new Date().toISOString();
  return {
    symbol,
    name:
      (typeof meta["longName"] === "string" && meta["longName"]) ||
      (typeof meta["shortName"] === "string" && meta["shortName"]) ||
      symbol,
    price,
    prevClose,
    change,
    changePct,
    volume: Math.round(Number(meta["regularMarketVolume"] ?? 0)) || 0,
    dayHigh: toCents(meta["regularMarketDayHigh"] ?? price / 100),
    dayLow: toCents(meta["regularMarketDayLow"] ?? price / 100),
    fiftyTwoWeekHigh: toCents(meta["fiftyTwoWeekHigh"] ?? price / 100),
    fiftyTwoWeekLow: toCents(meta["fiftyTwoWeekLow"] ?? price / 100),
    currency: "USD",
    asOf,
  };
}

interface YahooSparkResponse {
  spark?: {
    result?: Array<{
      symbol: string;
      response?: Array<{ meta?: Record<string, unknown> }>;
    }>;
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

/** Harga terakhir untuk banyak simbol (spark, 20 simbol/permintaan). */
export async function fetchQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const unique = Array.from(
    new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)),
  );
  const output = new Map<string, Quote>();
  if (!unique.length) return output;

  const groups = chunk(unique, 20);
  await mapLimit(groups, 3, async (group) => {
    const params = new URLSearchParams({
      symbols: group.join(","),
      range: "1d",
      interval: "1d",
      includePrePost: "false",
    });
    try {
      const payload = await cached(`spark:${group.join(",")}`, QUOTE_TTL_MS, () =>
        fetchJson<YahooSparkResponse>(`/v7/finance/spark?${params.toString()}`),
      );
      for (const row of payload.spark?.result ?? []) {
        const meta = row.response?.[0]?.meta;
        if (!meta) continue;
        output.set(row.symbol.toUpperCase(), quoteFromMeta(row.symbol.toUpperCase(), meta));
      }
    } catch {
      // Spark sering menolak sebagian simbol; jatuhkan ke chart per simbol.
    }
  });

  const missing = unique.filter((symbol) => !output.has(symbol));
  if (missing.length) {
    await mapLimit(missing, 6, async (symbol) => {
      const series = await fetchChart(symbol, "5d", "1d").catch(() => null);
      if (!series || !series.bars.length) return;
      const last = series.bars[series.bars.length - 1] as Bar;
      const prevClose = series.bars.length > 1 ? (series.bars[series.bars.length - 2] as Bar).c : series.prevClose;
      const change = last.c - prevClose;
      output.set(symbol, {
        symbol,
        name: symbol,
        price: last.c,
        prevClose,
        change,
        changePct: prevClose > 0 ? (change / prevClose) * 100 : 0,
        volume: last.v,
        dayHigh: last.h,
        dayLow: last.l,
        fiftyTwoWeekHigh: 0,
        fiftyTwoWeekLow: 0,
        currency: "USD",
        asOf: series.asOf,
      });
    });
  }

  return output;
}

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  const quotes = await fetchQuotes([symbol]);
  return quotes.get(symbol.trim().toUpperCase()) ?? null;
}

interface YahooSearchResponse {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    exchDisp?: string;
    quoteType?: string;
    typeDisp?: string;
  }>;
}

const US_EXCHANGES = new Set([
  "NMS",
  "NYQ",
  "NGM",
  "NCM",
  "ASE",
  "PCX",
  "BTS",
  "BATS",
  "NASDAQ",
  "NYSE",
  "AMEX",
  "NASDAQGS",
  "NASDAQGM",
  "NASDAQCM",
]);

/** Cari simbol saham AS (dipakai kotak pencarian inspeksi). */
export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  const term = query.trim();
  if (!term) return [];
  const results = await cached(`search:${term.toLowerCase()}`, SEARCH_TTL_MS, async () => {
    const params = new URLSearchParams({
      q: term,
      quotesCount: "12",
      newsCount: "0",
      listsCount: "0",
      enableFuzzyQuery: "false",
    });
    const payload = await fetchJson<YahooSearchResponse>(`/v1/finance/search?${params.toString()}`, 7000);
    const rows = (payload.quotes ?? [])
      .filter((row) => {
        const type = (row.quoteType ?? "").toUpperCase();
        const exchange = (row.exchange ?? "").toUpperCase();
        return (type === "EQUITY" || type === "ETF") && US_EXCHANGES.has(exchange);
      })
      .map((row) => ({
        symbol: (row.symbol ?? "").toUpperCase(),
        name: row.longname || row.shortname || row.symbol || "",
        exchange: row.exchDisp || row.exchange || "US",
      }))
      .filter((row) => row.symbol && /^[A-Z][A-Z0-9.\-]{0,9}$/.test(row.symbol));
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.symbol)) return false;
      seen.add(row.symbol);
      return true;
    });
  });
  return results.slice(0, 8);
}
