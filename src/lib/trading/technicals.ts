/**
 * Hitungan teknikal murni dari bar (tanpa I/O) untuk scanner & inspeksi.
 *
 * Semua harga dalam SEN. Rumus mengikuti paket skill day-trader:
 * RSI 14 Wilder, ATR 14, SMA 20/50, opening range 15 menit, dan lima setup
 * harian (breakout 20 hari, bull flag, reclaim MA20, oversold, oversold bounce).
 */

import type {
  Bar,
  CandleSeries,
  OpeningRange,
  Quote,
  SetupTag,
  Technicals,
} from "./types";
import { SETUP_LABELS } from "./types";
import { getEtParts, MARKET_OPEN_MINUTES, hhmmToMinutes, minutesToHHMM, closeMinutesFor } from "./market-clock";

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  return Math.round(slice.reduce((sum, value) => sum + value, 0) / period);
}

export function rsi14(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = (closes[i] as number) - (closes[i - 1] as number);
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i += 1) {
    const diff = (closes[i] as number) - (closes[i - 1] as number);
    avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function atr14(bars: Bar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const ranges: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const bar = bars[i] as Bar;
    const prev = bars[i - 1] as Bar;
    ranges.push(Math.max(bar.h - bar.l, Math.abs(bar.h - prev.c), Math.abs(bar.l - prev.c)));
  }
  const slice = ranges.slice(-period);
  return Math.round(slice.reduce((sum, value) => sum + value, 0) / slice.length);
}

/** Bar dari sesi terakhir saja (dipakai opening range & ORB). */
export function lastSessionBars(bars: Bar[]): Bar[] {
  if (!bars.length) return [];
  const lastDate = getEtParts(new Date(((bars[bars.length - 1] as Bar).t + 1) * 1000)).dateISO;
  return bars.filter((bar) => getEtParts(new Date((bar.t + 1) * 1000)).dateISO === lastDate);
}

/** Apakah bar sudah selesai (start + interval <= sekarang). */
export function isBarComplete(bar: Bar, intervalSeconds: number, nowMs: number = Date.now()): boolean {
  return bar.t * 1000 + intervalSeconds * 1000 <= nowMs;
}

/**
 * Opening range dari bar 5 menit: high/low bar pertama `minutes` menit.
 * Hanya menghitung bar yang sudah selesai.
 */
export function openingRange(
  bars: Bar[],
  minutes = 15,
  nowMs: number = Date.now(),
): OpeningRange | null {
  const session = lastSessionBars(bars).filter((bar) => isBarComplete(bar, 300, nowMs));
  const rangeBars = session.filter((bar) => {
    const etMinutes = getEtParts(new Date((bar.t + 1) * 1000)).minutes;
    return etMinutes >= MARKET_OPEN_MINUTES && etMinutes < MARKET_OPEN_MINUTES + minutes;
  });
  if (!rangeBars.length) return null;
  const high = Math.max(...rangeBars.map((bar) => bar.h));
  const low = Math.min(...rangeBars.map((bar) => bar.l));
  const expected = Math.max(1, Math.ceil(minutes / 5));
  return {
    minutes,
    high,
    low,
    mid: Math.round((high + low) / 2),
    bars: rangeBars.length,
    complete: rangeBars.length >= expected,
  };
}

export interface OrbDetection {
  hit: boolean;
  when: string | null;
  price: number | null;
  level: number | null;
  range: OpeningRange | null;
}

/** Tembus opening range: bar selesai pertama yang CLOSE di atas range high. */
export function detectOrb(
  bars: Bar[],
  minutes = 15,
  nowMs: number = Date.now(),
): OrbDetection {
  const range = openingRange(bars, minutes, nowMs);
  if (!range) return { hit: false, when: null, price: null, level: null, range: null };
  const session = lastSessionBars(bars);
  const rangeEnd = MARKET_OPEN_MINUTES + minutes;
  for (const bar of session) {
    const etMinutes = getEtParts(new Date((bar.t + 1) * 1000)).minutes;
    if (etMinutes < rangeEnd) continue;
    if (!isBarComplete(bar, 300, nowMs)) continue;
    if (bar.c > range.high) {
      return {
        hit: true,
        when: minutesToHHMM(etMinutes),
        price: bar.c,
        level: range.high,
        range,
      };
    }
  }
  return { hit: false, when: null, price: null, level: range.high, range };
}

function maxOf(values: number[]): number | null {
  if (!values.length) return null;
  return Math.max(...values);
}

function minOf(values: number[]): number | null {
  if (!values.length) return null;
  return Math.min(...values);
}

/** Lima setup harian dari tutup harian (cek semua yang cocok). */
export function detectDailySetups(bars: Bar[]): SetupTag[] {
  const tags: SetupTag[] = [];
  const closes = bars.map((bar) => bar.c);
  if (closes.length < 25) return tags;
  const last = closes[closes.length - 1] as number;
  const prev = closes[closes.length - 2] as number;
  const len = closes.length;

  const prior20 = closes.slice(len - 21, len - 1);
  const high20 = maxOf(prior20);
  if (high20 !== null && last > high20) {
    tags.push({
      key: "breakout_20d",
      label: SETUP_LABELS.breakout_20d,
      detail: `Tutup di atas semua ${prior20.length} tutup harian sebelumnya (tertinggi $${(high20 / 100).toFixed(2)}).`,
    });
  }

  // Bull flag: naik > 10% dalam 10 sesi, lalu 5 tutup terakhir menyempit <= 5%.
  const flagStart = closes[len - 15];
  const flagPeak = closes[len - 6];
  const lastFive = closes.slice(len - 5);
  if (flagStart && flagPeak && flagStart > 0 && lastFive.length === 5) {
    const runUp = (flagPeak / flagStart - 1) * 100;
    const flagHigh = maxOf(lastFive) as number;
    const flagLow = minOf(lastFive) as number;
    const flagRange = flagLow > 0 ? ((flagHigh - flagLow) / flagLow) * 100 : 100;
    if (runUp > 10 && flagRange <= 5) {
      tags.push({
        key: "bull_flag",
        label: SETUP_LABELS.bull_flag,
        detail: `Naik ${runUp.toFixed(1)}% dalam 10 sesi, lalu 5 tutup terakhir hanya bergerak ${flagRange.toFixed(1)}%.`,
      });
    }
  }

  const sma20Now = sma(closes, 20);
  const sma20Prev = sma(closes.slice(0, -1), 20);
  if (sma20Now !== null && sma20Prev !== null && prev < sma20Prev && last > sma20Now) {
    tags.push({
      key: "reclaim_ma20",
      label: SETUP_LABELS.reclaim_ma20,
      detail: `Kembali di atas rata-rata 20 hari ($${(sma20Now / 100).toFixed(2)}) setelah tutup sebelumnya di bawahnya.`,
    });
  }

  const rsi = rsi14(closes);
  const rsiPrev = rsi14(closes.slice(0, -1));
  if (rsi !== null && rsi < 30) {
    tags.push({
      key: "oversold",
      label: SETUP_LABELS.oversold,
      detail: `RSI 14 = ${rsi.toFixed(1)} (di bawah 30).`,
    });
  }
  if (rsiPrev !== null && rsiPrev < 30 && last > prev) {
    tags.push({
      key: "oversold_bounce",
      label: SETUP_LABELS.oversold_bounce,
      detail: `RSI kemarin ${rsiPrev.toFixed(1)} dan hari ini tutup naik ${(((last - prev) / prev) * 100).toFixed(1)}%.`,
    });
  }

  return tags;
}

export interface AnalysisOptions {
  symbol: string;
  daily: CandleSeries;
  intraday: CandleSeries | null;
  quote: Quote;
  /** Jam sekarang (ms) untuk menilai bar selesai. */
  nowMs?: number;
}

export interface Analysis {
  technicals: Technicals;
  setups: SetupTag[];
}

/** Teknikal + setup untuk inspeksi satu saham. */
export function analyze({ daily, intraday, quote, nowMs = Date.now() }: AnalysisOptions): Analysis {
  const dailyBars = daily.bars;
  const closes = dailyBars.map((bar) => bar.c);
  const etNow = getEtParts(new Date(nowMs));
  // Bar harian hari ini belum final selama sesi masih berjalan.
  const completed = dailyBars.filter((bar) => {
    const barDate = getEtParts(new Date(bar.t * 1000)).dateISO;
    if (barDate !== etNow.dateISO) return true;
    return etNow.minutes >= closeMinutesFor(etNow.dateISO);
  });
  const analysisBars = completed.length >= 25 ? completed : dailyBars;

  const sma20Value = sma(closes, 20);
  const sma50Value = sma(closes, 50);
  const rsi = rsi14(closes);
  const atr = atr14(analysisBars);
  const prior20 = closes.slice(Math.max(0, closes.length - 21), closes.length - 1);
  const high20 = maxOf(prior20);
  const low20 = minOf(prior20);
  const avgVolume20 = (() => {
    const sample = analysisBars.slice(-20);
    if (!sample.length) return null;
    return Math.round(sample.reduce((sum, bar) => sum + bar.v, 0) / sample.length);
  })();

  const intradayBars = intraday ? lastSessionBars(intraday.bars) : [];
  const range = intraday ? openingRange(intraday.bars, 15, nowMs) : null;
  const sessionHigh = intradayBars.length ? Math.max(...intradayBars.map((bar) => bar.h)) : null;
  const sessionLow = intradayBars.length ? Math.min(...intradayBars.map((bar) => bar.l)) : null;

  const technicals: Technicals = {
    last: quote.price,
    prevClose: quote.prevClose,
    changePct: quote.changePct,
    volume: quote.volume,
    sma20: sma20Value,
    sma50: sma50Value,
    rsi14: rsi,
    atr14: atr,
    atrPct: atr !== null && quote.price > 0 ? (atr / quote.price) * 100 : null,
    high20,
    low20,
    high52w: quote.fiftyTwoWeekHigh || null,
    low52w: quote.fiftyTwoWeekLow || null,
    avgVolume20,
    relVolume: avgVolume20 && quote.volume ? quote.volume / avgVolume20 : null,
    openingRange: range,
    dayHigh: sessionHigh ?? quote.dayHigh ?? null,
    dayLow: sessionLow ?? quote.dayLow ?? null,
  };

  const setups = detectDailySetups(analysisBars);

  if (range?.complete) {
    const orb = detectOrb(intraday?.bars ?? [], 15, nowMs);
    if (orb.hit) {
      setups.push({
        key: "orb_breakout",
        label: SETUP_LABELS.orb_breakout,
        detail: `Bar ${orb.when} ET tutup di $${((orb.price ?? 0) / 100).toFixed(2)}, di atas rentang $${(range.low / 100).toFixed(2)}–$${(range.high / 100).toFixed(2)}.`,
      });
    }
  }

  return { technicals, setups };
}

/** Jarak aman minimum stop dari entry (spread) = 0,05% seperti exit planner. */
export function minimumStopDistance(entry: number): number {
  return Math.max(1, Math.ceil(entry * 0.0005));
}

/** Bulatkan harga ke sen terdekat. */
export function roundToCent(value: number): number {
  return Math.round(value);
}

/** Ambil level harga terdekat dari ET jam (untuk label). */
export function etLabelForMinutes(minutes: number): string {
  return `${minutesToHHMM(minutes)} ET`;
}

export { hhmmToMinutes };
