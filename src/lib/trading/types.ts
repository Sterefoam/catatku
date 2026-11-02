/**
 * Tipe bersama modul Trading (Meja Trading Catatku).
 *
 * Aturan angka:
 * - SEMUA HARGA disimpan & dikirim dalam SEN (integer USD). $364.18 -> 36418.
 * - Nominal uang (budget, max loss, notional) juga SEN.
 * - Persentase disimpan sebagai angka persen biasa (1.25 = 1,25%).
 * - Volume dalam lembar (integer).
 * - Waktu: string ISO 8601 UTC, kecuali disebut "jam New York (ET)".
 */

/* ------------------------------------------------------------------ */
/* Pasar & sesi                                                        */
/* ------------------------------------------------------------------ */

export type MarketState =
  | "premarket"
  | "open"
  | "afterhours"
  | "closed"
  | "weekend"
  | "holiday";

export interface MarketStatus {
  state: MarketState;
  label: string;
  detail: string;
  /** Tanggal sesi bursa (YYYY-MM-DD, zona New York). */
  sessionDate: string;
  isTradingDay: boolean;
  earlyClose: boolean;
  /** ISO UTC; null bila bukan hari bursa. */
  openAt: string | null;
  closeAt: string | null;
  /** Waktu sekarang ET, mis. "2026-11-02T05:00:00-05:00". */
  nowEt: string;
  /** Kejadian berikutnya, mis. bel pembukaan / penutupan. */
  nextEvent: { at: string; label: string } | null;
}

/* ------------------------------------------------------------------ */
/* Harga & chart                                                       */
/* ------------------------------------------------------------------ */

export interface Quote {
  symbol: string;
  name: string;
  /** Harga terakhir (sen). */
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  currency: "USD";
  asOf: string;
}

export interface Bar {
  /** Unix detik (UTC) awal bar. */
  t: number;
  /** Open/High/Low/Close dalam sen. */
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type ChartInterval = "1m" | "5m" | "1d";

export interface CandleSeries {
  symbol: string;
  interval: ChartInterval;
  /** Rentang Yahoo: 1d, 5d, 1mo, 3mo, 6mo, 1y. */
  range: string;
  bars: Bar[];
  prevClose: number;
  asOf: string;
}

/* ------------------------------------------------------------------ */
/* Teknikal & setup                                                    */
/* ------------------------------------------------------------------ */

export interface OpeningRange {
  /** Menit pembentukan range (default 15). */
  minutes: number;
  high: number;
  low: number;
  mid: number;
  /** Jumlah bar yang membentuk range. */
  bars: number;
  complete: boolean;
}

export interface Technicals {
  last: number;
  prevClose: number;
  changePct: number;
  volume: number;
  sma20: number | null;
  sma50: number | null;
  rsi14: number | null;
  atr14: number | null;
  atrPct: number | null;
  high20: number | null;
  low20: number | null;
  high52w: number | null;
  low52w: number | null;
  avgVolume20: number | null;
  relVolume: number | null;
  openingRange: OpeningRange | null;
  dayHigh: number | null;
  dayLow: number | null;
}

export type SetupKey =
  | "breakout_20d"
  | "bull_flag"
  | "reclaim_ma20"
  | "oversold"
  | "oversold_bounce"
  | "orb_breakout";

export const SETUP_LABELS: Record<SetupKey, string> = {
  breakout_20d: "Tembus tertinggi 20 hari",
  bull_flag: "Bendera banteng",
  reclaim_ma20: "Kembali di atas MA20",
  oversold: "Jenuh jual (RSI < 30)",
  oversold_bounce: "Pantulan jenuh jual",
  orb_breakout: "Tembus opening range",
};

export interface SetupTag {
  key: SetupKey;
  label: string;
  detail: string;
}

/* ------------------------------------------------------------------ */
/* Inspeksi saham                                                      */
/* ------------------------------------------------------------------ */

export interface InspectDTO {
  symbol: string;
  name: string;
  quote: Quote;
  technicals: Technicals;
  setups: SetupTag[];
  /** 3 bulan bar harian. */
  daily: CandleSeries;
  /** Bar 5 menit sesi terakhir. */
  intraday: CandleSeries | null;
  /** Tanggal earnings berikutnya bila diketahui (ISO atau null). */
  earningsDate: string | null;
  /** Catatan risiko singkat untuk trader. */
  riskNotes: string[];
  asOf: string;
}

/* ------------------------------------------------------------------ */
/* Scanner                                                             */
/* ------------------------------------------------------------------ */

export type ScanMode = "daily" | "orb";

export interface ScanHit {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  setup: SetupTag;
  /** Untuk ORB: waktu bar tembus dalam ET, mis. "10:15". */
  when: string | null;
}

export interface ScanResult {
  mode: ScanMode;
  universe: string;
  asOf: string;
  /** Jumlah simbol yang dicoba. */
  scanned: number;
  /** Jumlah chart yang berhasil diambil. */
  fetched: number;
  failed: number;
  hits: ScanHit[];
  partial: boolean;
  note: string | null;
}

/* ------------------------------------------------------------------ */
/* Pengaturan & anggaran risiko                                        */
/* ------------------------------------------------------------------ */

export interface TradingSettings {
  mode: "paper";
  /** Modal trading (sen). */
  budget: number;
  maxLossPerTrade: number;
  maxPosition: number;
  maxOrder: number;
  cashBuffer: number;
  maxTradesPerDay: number;
  dailyLossLimit: number;
  /** Jam entry & flat-by dalam ET "HH:mm". */
  entryFrom: string;
  entryTo: string;
  flatBy: string;
  minRewardRisk: number;
  universe: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Rencana trading                                                     */
/* ------------------------------------------------------------------ */

export type SetupType = "orb" | "level" | "breakout20" | "flag";
export type StopRule = "or-mid" | "or-low" | "price" | "pct" | "atr";
export type TargetRule = "1R" | "1.5R" | "2R" | "price";
export type PlanStatus = "draft" | "active" | "triggered" | "done" | "cancelled";

export interface PlanDraft {
  symbol: string;
  setupType: SetupType;
  /** Harga pemicu entry (sen). */
  entryTrigger: number;
  stopRule: StopRule;
  stopPrice?: number | null;
  targetRule: TargetRule;
  targetPrice?: number | null;
  orHigh?: number | null;
  orLow?: number | null;
  orMinutes?: number | null;
  flatBy?: string | null;
  note?: string | null;
}

export interface RiskCheckItem {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

export interface SizeResult {
  qty: number;
  limitedBy: "max-loss" | "position-cap" | "max-order" | "cash" | "none";
  riskAmount: number;
  notional: number;
  cashAfter: number;
}

export interface PlanPreview {
  symbol: string;
  setupType: SetupType;
  entry: number;
  stop: number;
  target: number;
  stopRuleLabel: string;
  targetRuleLabel: string;
  riskPerShare: number;
  rewardPerShare: number;
  rewardRisk: number;
  rMultiple: number;
  orHigh: number | null;
  orLow: number | null;
  flatBy: string;
  size: SizeResult;
  checks: RiskCheckItem[];
  ok: boolean;
  errors: string[];
}

export interface TradePlanDTO extends PlanPreview {
  id: string;
  status: PlanStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Order kertas (paper trading)                                        */
/* ------------------------------------------------------------------ */

export type OrderStatus = "pending" | "filled" | "closed" | "cancelled";
export type ExitReason = "target" | "stop" | "flat-by" | "manual" | null;

export interface OrderDTO {
  id: string;
  planId: string | null;
  symbol: string;
  qty: number;
  entry: number;
  stop: number;
  target: number;
  status: OrderStatus;
  filledAt: string | null;
  filledPrice: number | null;
  closedAt: string | null;
  closedPrice: number | null;
  exitReason: ExitReason;
  riskAmount: number;
  /** Hasil paper (sen): (closedPrice - entry) * qty. */
  pnl: number | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Alert harga                                                         */
/* ------------------------------------------------------------------ */

export type AlertKind =
  | "above"
  | "below"
  | "stop"
  | "target"
  | "pct"
  | "bell"
  | "flat-by";

export interface AlertDTO {
  id: string;
  symbol: string;
  kind: AlertKind;
  level: number | null;
  pct: number | null;
  label: string;
  isActive: boolean;
  triggeredAt: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Watchlist                                                           */
/* ------------------------------------------------------------------ */

export interface WatchlistItemDTO {
  id: string;
  symbol: string;
  name: string;
  source: "manual" | "scan";
  note: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Berita & SEC                                                        */
/* ------------------------------------------------------------------ */

export interface NewsItem {
  id: string;
  symbol: string;
  kind: "headline" | "filing";
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  tags: string[];
  important: boolean;
  summary: string | null;
}

export interface FilingItem {
  form: string;
  filedAt: string;
  title: string;
  url: string;
  important: boolean;
}

export interface FundamentalsPeriod {
  /** "Q" atau "FY". */
  kind: "quarter" | "year";
  label: string;
  end: string;
  revenue: number | null;
  netIncome: number | null;
  epsDiluted: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
}

export interface FundamentalsDTO {
  symbol: string;
  companyName: string;
  cik: string | null;
  periods: FundamentalsPeriod[];
  ttm: {
    revenue: number | null;
    netIncome: number | null;
    epsDiluted: number | null;
  } | null;
  yoy: {
    revenuePct: number | null;
    netIncomePct: number | null;
  } | null;
  source: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Time machine                                                        */
/* ------------------------------------------------------------------ */

export interface TimeMachineHistoryRow {
  date: string;
  outcome: "target" | "stop" | "none";
  r: number;
}

export interface TimeMachineResult {
  symbol: string;
  entry: number;
  stop: number;
  target: number;
  riskPerShare: number;
  simulations: number;
  targetFirstPct: number;
  stopFirstPct: number;
  neitherPct: number;
  /** Rata-rata R bila target/stop kena lebih dulu, selain itu 0. */
  avgR: number;
  /** Harga penutupan sesi simulasi di atas entry. */
  closeUpPct: number;
  closeDownPct: number;
  historySessions: number;
  history: TimeMachineHistoryRow[];
  assumptions: string[];
}

/* ------------------------------------------------------------------ */
/* Pemicu entry                                                        */
/* ------------------------------------------------------------------ */

export type TriggerStatus =
  | "waiting"
  | "triggered"
  | "expired"
  | "not-open"
  | "no-data";

export interface TriggerState {
  status: TriggerStatus;
  symbol: string;
  level: number | null;
  last: number | null;
  distancePct: number | null;
  barTime: string | null;
  price: number | null;
  message: string;
  openingRange: OpeningRange | null;
}

/* ------------------------------------------------------------------ */
/* Pencarian simbol                                                    */
/* ------------------------------------------------------------------ */

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
}
