/**
 * Pemindai saham (scanner) Meja Trading.
 *
 * Dua mode:
 * - `daily`: lima setup harian dari bar harian 3 bulan (butuh ±1 bulan bar).
 * - `orb`: tembus rentang awal 15 menit pada bar 5 menit sesi berjalan.
 *
 * Catatan kejujuran:
 * - Data dari Yahoo Finance gratis dan bisa tertunda — bukan real time.
 * - Pemindaian hanya mencakup daftar saham yang dipilih (maks 100 simbol), bukan
 *   seluruh pasar. Hasil = "cocok dengan aturan", bukan ajakan membeli.
 * - Harga & volume selalu SEN/lembar; scanner hanya mengembalikan hasil,
 *   tidak menulis DB.
 */

import {
  AFTERHOURS_END_MINUTES,
  closeMinutesFor,
  getEtParts,
  isTradingDay,
  MARKET_OPEN_MINUTES,
  minutesToHHMM,
  PREMARKET_MINUTES,
} from "./market-clock";
import { watchlistSymbols } from "./data";
import { detectDailySetups, detectOrb, lastSessionBars } from "./technicals";
import { SETUP_LABELS } from "./types";
import type {
  Bar,
  ScanHit,
  ScanMode,
  ScanResult,
  SetupKey,
  SetupTag,
} from "./types";
import {
  findUniverseSymbol,
  universeSymbols,
  type UniverseKey,
} from "./universe";
import { fetchChart, fetchQuotes, mapLimit } from "./yahoo";

/** Batas maksimum simbol per pemindaian (jangan membombardir API gratis). */
export const SCAN_MAX_SYMBOLS = 100;
/** Batas jumlah sinyal yang dikembalikan. */
export const SCAN_MAX_HITS = 50;
/** Permintaan HTTP paralel ke Yahoo. */
export const SCAN_CONCURRENCY = 6;
/** Filter likuiditas: harga minimal $5. */
export const SCAN_MIN_PRICE_CENTS = 500;
/** Filter likuiditas: rata-rata volume 20 hari minimal 1 juta lembar. */
export const SCAN_MIN_AVG_VOLUME = 1_000_000;
/** Opening range ORB (menit). */
export const ORB_RANGE_MINUTES = 15;

export interface ScanStocksOptions {
  mode?: ScanMode | string | null;
  universe?: string | null;
  symbols?: string[] | null;
  limit?: number | null;
  userId?: string | null;
  /** Titik waktu untuk pengujian / konsistensi jam bursa. */
  now?: Date;
}

interface ScanPass {
  fetched: number;
  failed: number;
  insufficient: number;
  hits: ScanHit[];
}

const SETUP_PRIORITY: SetupKey[] = [
  "breakout_20d",
  "bull_flag",
  "reclaim_ma20",
  "oversold_bounce",
  "oversold",
];

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function usd(cents: number): string {
  return (cents / 100).toFixed(2);
}

function normalizeUniverse(value?: string | null): UniverseKey {
  const key = (value ?? "").trim().toLowerCase();
  if (key === "mega" || key === "watchlist" || key === "symbols") return key;
  return "sp100";
}

function normalizeTicker(value: string): string | null {
  const clean = value.trim().toUpperCase();
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(clean) ? clean : null;
}

function initialName(symbol: string): string {
  return findUniverseSymbol(symbol)?.name ?? symbol;
}

/** Setup paling relevan untuk ditampilkan pada satu baris hasil. */
function pickSetup(tags: SetupTag[]): SetupTag {
  for (const key of SETUP_PRIORITY) {
    const found = tags.find((tag) => tag.key === key);
    if (found) return found;
  }
  return tags[0] as SetupTag;
}

/** Bar harian yang sudah selesai — bar hari ini diabaikan selama sesi berjalan. */
function completedDailyBars(bars: Bar[], nowMs: number): Bar[] {
  const etNow = getEtParts(new Date(nowMs));
  return bars.filter((bar) => {
    const barDate = getEtParts(new Date(bar.t * 1000)).dateISO;
    if (barDate !== etNow.dateISO) return true;
    return etNow.minutes >= closeMinutesFor(etNow.dateISO);
  });
}

function averageVolume(bars: Bar[], period = 20): number | null {
  const sample = bars.slice(-period);
  if (!sample.length) return null;
  const total = sample.reduce((sum, bar) => sum + bar.v, 0);
  return Math.round(total / sample.length);
}

/**
 * Mode ORB hanya bermakna setelah opening range 15 menit selesai (09.45 ET)
 * dan bar konfirmasi pertama bisa selesai (09.50 ET). Di luar sesi bursa
 * pemindaian ORB tidak dijalankan supaya tidak menampilkan sinyal basi.
 */
function orbGate(now: Date): string | null {
  const parts = getEtParts(now);
  if (!isTradingDay(parts.dateISO)) {
    return `Bursa tutup (${parts.dateISO}). Mode saat pasar buka butuh sesi berjalan — coba mode harian atau pindai lagi saat pasar buka.`;
  }
  if (parts.minutes < PREMARKET_MINUTES || parts.minutes >= AFTERHOURS_END_MINUTES) {
    return "Bursa sedang tutup (di luar sesi). Mode saat pasar buka butuh sesi berjalan — coba mode harian atau pindai lagi saat pasar buka.";
  }
  if (parts.minutes < MARKET_OPEN_MINUTES + 20) {
    return `Rentang awal 15 menit belum selesai. Mode saat pasar buka bisa dipakai setelah 09.50 ET (sekarang ${minutesToHHMM(parts.minutes)} ET).`;
  }
  return null;
}

async function resolveSymbols(options: ScanStocksOptions): Promise<{
  key: UniverseKey;
  symbols: string[];
  notes: string[];
}> {
  const key = normalizeUniverse(options.universe);
  const notes: string[] = [];
  let symbols: string[] = [];

  if (key === "watchlist") {
    if (!options.userId) {
      notes.push("Daftar pantau hanya bisa dipindai setelah kamu masuk.");
    } else {
      try {
        symbols = await watchlistSymbols(options.userId);
      } catch {
        notes.push("Gagal membaca daftar pantau. Coba muat ulang halaman.");
      }
    }
    if (!symbols.length) {
      notes.push("Daftar pantau kamu masih kosong — tambahkan saham dulu atau pakai 100 saham likuid.");
    }
  } else if (key === "symbols") {
    symbols = (options.symbols ?? [])
      .map(normalizeTicker)
      .filter((symbol): symbol is string => symbol !== null);
    if (!symbols.length) {
      notes.push("Tidak ada simbol saham yang valid untuk dipindai.");
    }
  } else {
    symbols = universeSymbols(key).map((row) => row.symbol);
  }

  const unique = Array.from(new Set(symbols));
  const limit = clampInt(options.limit ?? SCAN_MAX_SYMBOLS, 1, SCAN_MAX_SYMBOLS);
  if (unique.length > limit) {
    notes.push(`Daftar dibatasi ${limit} dari ${unique.length} simbol supaya pemindaian tetap ringan.`);
  }

  return { key, symbols: unique.slice(0, limit), notes };
}

/** Isi nama perusahaan untuk simbol di luar semesta kurasi (satu panggilan batch). */
async function attachNames(hits: ScanHit[]): Promise<void> {
  const missing = hits
    .filter((hit) => hit.name === hit.symbol)
    .map((hit) => hit.symbol);
  if (!missing.length) return;
  try {
    const quotes = await fetchQuotes(missing);
    for (const hit of hits) {
      const quote = quotes.get(hit.symbol);
      if (quote && quote.name && quote.name !== hit.symbol && quote.name !== hit.symbol.toUpperCase()) {
        hit.name = quote.name;
      }
    }
  } catch {
    // Nama opsional — simbol tetap tampil walau nama gagal diambil.
  }
}

/** Mode harian: lima setup dari tutup harian + filter likuiditas. */
async function runDailyScan(symbols: string[], nowMs: number): Promise<ScanPass> {
  let fetched = 0;
  let failed = 0;
  let insufficient = 0;
  const hits: ScanHit[] = [];

  await mapLimit(symbols, SCAN_CONCURRENCY, async (symbol) => {
    const series = await fetchChart(symbol, "3mo", "1d").catch(() => null);
    if (!series || !series.bars.length) {
      failed += 1;
      return;
    }
    fetched += 1;

    const bars = series.bars;
    const completed = completedDailyBars(bars, nowMs);
    const signalBars = completed.length >= 26 ? completed : bars;
    if (signalBars.length < 26) {
      insufficient += 1;
      return;
    }

    const setups = detectDailySetups(signalBars);
    if (!setups.length) return;

    const lastBar = bars[bars.length - 1];
    if (!lastBar) return;
    const prevBar = bars.length > 1 ? bars[bars.length - 2] : null;
    const price = lastBar.c;
    const prevClose = prevBar && prevBar.c > 0 ? prevBar.c : series.prevClose;
    const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    const volume = lastBar.v;
    const avgVolume = averageVolume(signalBars, 20);

    // Filter likuiditas: harga >= $5 & rata-rata volume >= 1 juta lembar.
    if (price < SCAN_MIN_PRICE_CENTS) return;
    if (avgVolume === null) {
      if (volume < SCAN_MIN_AVG_VOLUME) return;
    } else if (avgVolume < SCAN_MIN_AVG_VOLUME) {
      return;
    }

    hits.push({
      symbol,
      name: initialName(symbol),
      price,
      changePct: round2(changePct),
      volume,
      setup: pickSetup(setups),
      when: null,
    });
  });

  return { fetched, failed, insufficient, hits };
}

/** Mode ORB: bar 5 menit selesai pertama yang tutup di atas rentang awal. */
async function runOrbScan(symbols: string[], nowMs: number): Promise<ScanPass> {
  let fetched = 0;
  let failed = 0;
  let insufficient = 0;
  const hits: ScanHit[] = [];

  await mapLimit(symbols, SCAN_CONCURRENCY, async (symbol) => {
    const series = await fetchChart(symbol, "1d", "5m").catch(() => null);
    if (!series || !series.bars.length) {
      failed += 1;
      return;
    }
    fetched += 1;

    const session = lastSessionBars(series.bars);
    if (!session.length) {
      insufficient += 1;
      return;
    }

    const orb = detectOrb(series.bars, ORB_RANGE_MINUTES, nowMs);
    if (!orb.hit) return;

    const lastBar = session[session.length - 1];
    if (!lastBar) return;
    const price = lastBar.c;
    if (price < SCAN_MIN_PRICE_CENTS) return;

    const volume = session.reduce((sum, bar) => sum + bar.v, 0);
    const prevClose = series.prevClose > 0 ? series.prevClose : (session[0] as Bar).o;
    const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    const range = orb.range;

    const setup: SetupTag = {
      key: "orb_breakout",
      label: SETUP_LABELS.orb_breakout,
      detail:
        range !== null
          ? `Bar ${orb.when ?? "—"} ET tutup di $${usd(orb.price ?? price)}, di atas rentang awal $${usd(range.low)}–$${usd(range.high)}.`
          : `Bar ${orb.when ?? "—"} ET tutup di $${usd(orb.price ?? price)}, di atas rentang awal.`,
    };

    hits.push({
      symbol,
      name: initialName(symbol),
      price,
      changePct: round2(changePct),
      volume,
      setup,
      when: orb.when,
    });
  });

  return { fetched, failed, insufficient, hits };
}

/**
 * Jalankan pemindaian. Selalu mengembalikan `ScanResult` (tidak melempar untuk
 * kegagalan per-simbol); kegagalan total (mis. DB watchlist) ditangani route.
 */
export async function scanStocks(options: ScanStocksOptions = {}): Promise<ScanResult> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const mode: ScanMode = options.mode === "orb" ? "orb" : "daily";
  const { key, symbols, notes } = await resolveSymbols(options);

  const empty: ScanResult = {
    mode,
    universe: key,
    asOf: now.toISOString(),
    scanned: symbols.length,
    fetched: 0,
    failed: 0,
    hits: [],
    partial: false,
    note: notes.length ? notes.join(" ") : null,
  };

  if (!symbols.length) return empty;

  if (mode === "orb") {
    const gate = orbGate(now);
    if (gate) {
      return {
        ...empty,
        scanned: 0,
        note: [...notes, gate].join(" "),
      };
    }
    const parts = getEtParts(now);
    if (parts.minutes >= closeMinutesFor(parts.dateISO)) {
      notes.push("Sesi hari ini sudah selesai — hasil ORB berasal dari sesi yang baru ditutup.");
    }
  }

  const pass =
    mode === "daily"
      ? await runDailyScan(symbols, nowMs)
      : await runOrbScan(symbols, nowMs);

  const hits = pass.hits
    .sort((a, b) => b.price * b.volume - a.price * a.volume)
    .slice(0, SCAN_MAX_HITS);
  await attachNames(hits);

  if (pass.insufficient > 0) {
    notes.push(
      mode === "daily"
        ? `${pass.insufficient} simbol belum punya cukup bar harian (butuh ±1 bulan).`
        : `${pass.insufficient} simbol belum punya data 5 menit untuk sesi ini.`,
    );
  }
  if (pass.failed > 0) {
    notes.push(`${pass.failed} simbol gagal diambil datanya — coba pindai lagi sebentar.`);
  }
  if (!hits.length) {
    notes.push(
      mode === "daily"
        ? "Tidak ada saham di daftar ini yang cocok dengan lima aturan harian saat ini."
        : "Belum ada saham di daftar ini yang tembus rentang awal 15 menit.",
    );
  }

  return {
    mode,
    universe: key,
    asOf: now.toISOString(),
    scanned: symbols.length,
    fetched: pass.fetched,
    failed: pass.failed,
    hits,
    partial: pass.failed > 0,
    note: notes.length ? notes.join(" ") : null,
  };
}
