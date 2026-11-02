/**
 * Label, opsi, dan helper kecil untuk Meja Transaksi (modul desk).
 * Aman dipakai di client component; tidak menyentuh API atau data pasar.
 *
 * Aturan bahasa: lihat docs/UI-COPY.md. Kata "entry/stop/target/paper/notional"
 * boleh muncul di kode, tapi TIDAK di teks yang dibaca pengguna.
 */

import { parseAmountToMinor } from "@/lib/money";
import type {
  AlertKind,
  ExitReason,
  OrderStatus,
  PlanStatus,
  RiskCheckItem,
  SetupType,
  SizeResult,
  StopRule,
  TargetRule,
} from "@/lib/trading/types";

/* ------------------------------------------------------------------ */
/* Label jenis setup & aturan                                          */
/* ------------------------------------------------------------------ */

export const SETUP_TYPE_LABELS: Record<SetupType, string> = {
  orb: "Tembus rentang awal",
  level: "Level manual",
  breakout20: "Tembus tertinggi 20 hari",
  flag: "Pola bendera",
};

export const SETUP_TYPE_OPTIONS: { value: SetupType; label: string }[] = [
  { value: "orb", label: "Rentang awal" },
  { value: "level", label: "Level sendiri" },
  { value: "breakout20", label: "20 hari" },
  { value: "flag", label: "Bendera" },
];

export const SETUP_TYPE_HINTS: Record<SetupType, string> = {
  orb: "Harga masuk di atas rentang 15 menit pertama (09.30–09.45 ET).",
  level: "Harga masuk memakai level yang kamu isi sendiri.",
  breakout20: "Harga masuk menembus tertinggi 20 hari terakhir.",
  flag: "Harga masuk saat pola bendera banteng selesai.",
};

export const STOP_RULE_LABELS: Record<StopRule, string> = {
  "or-mid": "Titik tengah rentang awal",
  "or-low": "Batas bawah rentang awal",
  price: "Harga batas rugi sendiri",
  pct: "Persen di bawah harga masuk",
  atr: "Kelipatan ayunan harga (ATR)",
};

/** Aturan batas rugi yang bisa diisi sendiri (di dalam "Aturan lanjutan"). */
export const ADVANCED_STOP_OPTIONS: {
  value: Extract<StopRule, "pct" | "atr" | "price">;
  label: string;
}[] = [
  { value: "pct", label: "Persen di bawah harga masuk" },
  { value: "atr", label: "Kelipatan ayunan harga (ATR)" },
  { value: "price", label: "Harga batas rugi sendiri" },
];

export const TARGET_RULE_LABELS: Record<TargetRule, string> = {
  "1R": "1R (untung 1 kali kerugian)",
  "1.5R": "1,5R (untung 1,5 kali kerugian)",
  "2R": "2R (untung 2 kali kerugian)",
  price: "Harga target sendiri",
};

export const TARGET_RULE_OPTIONS: { value: TargetRule; label: string }[] = [
  { value: "1R", label: "1R" },
  { value: "1.5R", label: "1,5R" },
  { value: "2R", label: "2R" },
];

/* ------------------------------------------------------------------ */
/* Label status order, rencana, alert                                  */
/* ------------------------------------------------------------------ */

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Menunggu",
  filled: "Terbuka",
  closed: "Selesai",
  cancelled: "Dibatalkan",
};

export const ORDER_STATUS_TONES: Record<
  OrderStatus,
  "warning" | "success" | "neutral" | "danger"
> = {
  pending: "warning",
  filled: "success",
  closed: "neutral",
  cancelled: "danger",
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Draf",
  active: "Aktif",
  triggered: "Sudah kena harga masuk",
  done: "Selesai",
  cancelled: "Dibatalkan",
};

export const EXIT_REASON_LABELS: Record<NonNullable<ExitReason>, string> = {
  target: "Target untung kena",
  stop: "Batas rugi kena",
  "flat-by": "Jam keluar",
  manual: "Ditutup manual",
};

export const SIZE_LIMIT_LABELS: Record<SizeResult["limitedBy"], string> = {
  "max-loss": "dibatasi rugi maksimal per trade",
  "position-cap": "dibatasi ukuran posisi maksimal",
  "max-order": "dibatasi nilai order maksimal",
  cash: "dibatasi kas yang disisakan",
  none: "tanpa batas",
};

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  above: "Harga di atas level",
  below: "Harga di bawah level",
  stop: "Menyentuh batas rugi",
  target: "Mencapai target untung",
  pct: "Perubahan persen",
  bell: "Bel pembukaan",
  "flat-by": "Jam keluar (flat by)",
};

export const ALERT_KIND_OPTIONS: { value: AlertKind; label: string; hint: string }[] = [
  { value: "above", label: "Harga di atas level", hint: "Berbunyi saat harga naik melewati level." },
  { value: "below", label: "Harga di bawah level", hint: "Berbunyi saat harga turun melewati level." },
  { value: "stop", label: "Menyentuh batas rugi", hint: "Berbunyi saat harga menyentuh batas rugi." },
  { value: "target", label: "Mencapai target untung", hint: "Berbunyi saat harga menyentuh target." },
  { value: "pct", label: "Perubahan persen", hint: "Berbunyi saat harga bergerak sekian % dari penutupan sebelumnya." },
  { value: "bell", label: "Bel pembukaan NYSE", hint: "Berbunyi sekali saat pasar buka (09.30 ET)." },
  { value: "flat-by", label: "Jam keluar", hint: "Berbunyi saat sudah waktunya menutup semua posisi." },
];

/* ------------------------------------------------------------------ */
/* Penerjemah teks server (label dari engine/api) ke bahasa manusia    */
/* ------------------------------------------------------------------ */

/**
 * Label aturan batas rugi dari server masih memakai istilah teknis
 * ("Persen dari entry", "Tengah opening range"). Ubah ke bahasa UI.
 */
export function humaniseStopRuleLabel(raw: string): string {
  const mapped = STOP_RULE_LABELS[raw as StopRule];
  if (mapped) return mapped;
  return raw
    .replace(/di bawah entry/gi, "di bawah harga masuk")
    .replace(/dari entry/gi, "dari harga masuk")
    .replace(/opening range/gi, "rentang awal")
    .replace(/× ATR 14/g, "× ayunan harga (ATR)")
    .replace(/\bATR 14\b/g, "ayunan harga (ATR)")
    .replace(/\bentry\b/gi, "harga masuk")
    .replace(/(\d),(\d)0%/g, "$1,$2%")
    .replace(/(\d),0%/g, "$1%");
}

/** Label target dari server: "2R" → "untung 2 kali kerugian". */
export function humaniseTargetRuleLabel(raw: string): string {
  const mapped = TARGET_RULE_LABELS[raw as TargetRule];
  if (mapped) return mapped;
  return raw.replace(/opening range/gi, "rentang awal").replace(/\bentry\b/gi, "harga masuk");
}

/**
 * Label cek risiko dari engine masih memakai istilah teknis. Ganti dengan
 * label manusia berdasarkan id cek (id stabil, lihat plan-engine.ts).
 */
const RISK_CHECK_LABELS: Record<string, string> = {
  entry: "Harga masuk",
  stop: "Batas rugi terpasang",
  target: "Target untung di atas harga masuk",
  "stop-distance": "Jarak batas rugi aman",
  size: "Jumlah lembar",
  risk: "Kerugian kalau kena batas rugi",
  rr: "Imbalan : risiko",
  "daily-risk": "Batas rugi harian",
  trades: "Jumlah trade hari ini",
  "entry-window": "Jam masuk",
  market: "Pasar buka",
  "price-sync": "Harga masuk selaras pasar",
  volume: "Ramai diperdagangkan",
};

/** Bersihkan istilah teknis di detail cek risiko. */
export function humaniseRiskDetail(text: string): string {
  return text
    .replace(/\bnotional\b/gi, "nilai beli")
    .replace(/\bqty\b/gi, "lembar")
    .replace(/\bpemicu entry\b/gi, "harga masuk")
    .replace(/\bPemicu\b/g, "Harga masuk")
    .replace(/\bpemicu\b/gi, "harga masuk")
    .replace(/harga entry/gi, "harga masuk")
    .replace(/\bentry\b/gi, "harga masuk")
    .replace(/\bStop\b/g, "Batas rugi")
    .replace(/\bstop\b/gi, "batas rugi")
    .replace(/ukuran posisi/gi, "jumlah lembar")
    .replace(/opening range/gi, "rentang awal")
    .replace(/\bATR 14\b/g, "ayunan harga (ATR)");
}

export function humaniseCheck(check: RiskCheckItem): RiskCheckItem {
  return {
    ...check,
    label: RISK_CHECK_LABELS[check.id] ?? check.label,
    detail: humaniseRiskDetail(check.detail),
  };
}

/** Label alert dari server ("TSLA kena stop di ...") → bahasa manusia. */
export function humaniseAlertLabel(label: string): string {
  return label
    .replace(/^Waktunya flat by /i, "Jam keluar (flat by) ")
    .replace(/ kena stop di /i, " menyentuh batas rugi di ")
    .replace(/ capai target /i, " mencapai target untung ");
}

/** 2 → "untung 2 kali kerugian". */
export function rMultipleText(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `untung ${value.toFixed(1).replace(".", ",")} kali kerugian`;
}

/* ------------------------------------------------------------------ */
/* Helper input harga & angka                                          */
/* ------------------------------------------------------------------ */

/** "364.18" / "364,18" → 36418 (sen). null bila kosong/tidak valid. */
export function parsePriceInput(raw: string): number | null {
  const value = parseAmountToMinor(raw, "USD");
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

/**
 * Nominal uang dalam dolar → sen. `allowZero` dipakai untuk buffer kas yang
 * boleh 0. Mengembalikan null bila kosong, negatif, atau bukan angka.
 */
export function parseMoneyInput(raw: string, allowZero = false): number | null {
  const value = parseAmountToMinor(raw, "USD");
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  if (value === 0 && !allowZero) return null;
  return Math.round(value);
}

/** "1,5" → 1.5. null bila kosong/tidak valid. */
export function parseDecimalInput(raw: string): number | null {
  if (!raw.trim()) return null;
  const normalised = raw.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}

/** 36418 → "364.18" untuk nilai input. */
export function centsToPriceInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2);
}

/** 1.5 → "1,5" untuk nilai input. */
export function decimalToInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return String(value).replace(".", ",");
}

/** Parameter stop untuk aturan "pct"/"atr" dikirim lewat stopPrice × 100. */
export function encodeStopParam(value: number): number {
  return Math.round(value * 100);
}

/** Body PlanDraft yang dikirim ke /api/trading/plans/preview dan /plans. */
export interface PlanDraftBody {
  symbol: string;
  setupType: SetupType;
  entryTrigger: number;
  stopRule: StopRule;
  stopPrice: number | null;
  targetRule: TargetRule;
  targetPrice: number | null;
  orHigh: number | null;
  orLow: number | null;
  orMinutes: number | null;
  flatBy: string | null;
  note: string | null;
}

export const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.\-]{0,9}$/;

/** Normalisasi teks simbol dari input pengguna. */
export function normaliseSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}
