/**
 * Format angka khusus trading. Aman dipakai di client & server.
 * Harga selalu dalam SEN (integer USD).
 */

import { formatMoney } from "@/lib/money";

/** "$364.18" */
export function fmtPrice(cents: number): string {
  return formatMoney(cents, "USD");
}

/** Samakan dengan fmtPrice supaya niat terbaca di kode. */
export function fmtUsd(cents: number): string {
  return formatMoney(cents, "USD");
}

/** "+$12.50" / "−$3.20" */
export function fmtCentsSigned(cents: number): string {
  if (!Number.isFinite(cents) || cents === 0) return "$0.00";
  return `${cents > 0 ? "+" : "−"}${formatMoney(Math.abs(cents), "USD")}`;
}

/** "+1,25%" — angka persen biasa (1.25 = 1,25%). */
export function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits).replace(".", ",")}%`;
}

/** "2,0R" */
export function fmtR(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits).replace(".", ",")}R`;
}

/** "12,4 juta" lembar — satuan Indonesia, bukan singkatan "jt" yang ambigu. */
export function fmtVolume(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const nf = (number: number, digits: number) =>
    new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(number);
  if (abs >= 1_000_000_000_000) return `${nf(value / 1_000_000_000_000, 1)} triliun`;
  if (abs >= 1_000_000_000) return `${nf(value / 1_000_000_000, 1)} miliar`;
  if (abs >= 1_000_000) return `${nf(value / 1_000_000, 1)} juta`;
  if (abs >= 1_000) return `${nf(value / 1_000, 0)} ribu`;
  return nf(value, 0);
}

/** "1.250" lembar. */
export function fmtQty(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("id-ID").format(value);
}

/** "Sen, 2 Nov 2026 · 10:15 ET" dari ISO. */
export function fmtEtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = new Intl.DateTimeFormat("id-ID", {
    timeZone: "America/New_York",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${day} · ${time} ET`;
}

/** "10:15 ET" */
export function fmtEtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)} ET`;
}

/** "2 Nov 2026" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Angka dolar BESAR (bukan sen) dengan satuan Indonesia yang mudah dibaca:
 * "$103,6 miliar", "$787 juta", "$4,5 ribu". Untuk fundamental SEC.
 */
export function fmtUsdCompact(dollars: number | null | undefined): string {
  if (dollars === null || dollars === undefined || !Number.isFinite(dollars)) return "—";
  const sign = dollars < 0 ? "−" : "";
  const abs = Math.abs(dollars);
  const nf = (value: number, digits: number) =>
    new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(value);
  if (abs >= 1_000_000_000_000) return `${sign}$${nf(abs / 1_000_000_000_000, 1)} triliun`;
  if (abs >= 1_000_000_000) return `${sign}$${nf(abs / 1_000_000_000, 1)} miliar`;
  if (abs >= 1_000_000) return `${sign}$${nf(abs / 1_000_000, 1)} juta`;
  if (abs >= 1_000) return `${sign}$${nf(abs / 1_000, 0)} ribu`;
  return `${sign}$${nf(abs, 2)}`;
}

/** Dolar biasa (bukan sen) dengan 2 desimal: "$0,22". */
export function fmtUsdDollars(dollars: number | null | undefined, digits = 2): string {
  if (dollars === null || dollars === undefined || !Number.isFinite(dollars)) return "—";
  const sign = dollars < 0 ? "−" : "";
  return `${sign}$${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(dollars))}`;
}

/** "3 menit lalu" (bahasa Indonesia santai). */
export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}
