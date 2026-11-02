/**
 * Jam bursa New York (NYSE) — dihitung sendiri, tanpa dependensi.
 *
 * - Semua perhitungan memakai zona "America/New_York" lewat Intl.
 * - Hari libur & penutupan dini 2026–2027 sesuai kalender NYSE.
 * - Sesi: pra-pasar 04.00, buka 09.30, tutup 16.00 (13.00 bila tutup dini),
 *   pasca-pasar sampai 20.00 ET.
 */

import type { MarketState, MarketStatus } from "./types";

export const ET_TZ = "America/New_York";
export const MARKET_OPEN_MINUTES = 9 * 60 + 30;
export const MARKET_CLOSE_MINUTES = 16 * 60;
export const EARLY_CLOSE_MINUTES = 13 * 60;
export const PREMARKET_MINUTES = 4 * 60;
export const AFTERHOURS_END_MINUTES = 20 * 60;

/** Libur bursa NYSE (zona New York). */
export const MARKET_HOLIDAYS = new Set<string>([
  // 2026
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  // 2027
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
]);

/** Hari dengan penutupan dini pukul 13.00 ET. */
export const EARLY_CLOSES = new Set<string>([
  "2026-07-02",
  "2026-11-27",
  "2026-12-24",
  "2027-07-02",
  "2027-11-26",
]);

const ET_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: ET_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const ET_WEEKDAY = new Intl.DateTimeFormat("en-US", {
  timeZone: ET_TZ,
  weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface EtParts {
  /** "YYYY-MM-DD" di New York. */
  dateISO: string;
  /** Menit sejak tengah malam ET (0..1439). */
  minutes: number;
  /** 0 = Minggu ... 6 = Sabtu. */
  weekday: number;
  /** ISO UTC dari `now`. */
  iso: string;
}

export function getEtParts(now: Date = new Date()): EtParts {
  const parts = ET_PARTS.formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const dateISO = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const weekdayLabel = ET_WEEKDAY.format(now);
  return {
    dateISO,
    minutes: hour * 60 + minute,
    weekday: WEEKDAYS.indexOf(weekdayLabel),
    iso: now.toISOString(),
  };
}

function etOffsetMs(date: Date): number {
  const parts = ET_PARTS.formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const wallAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return wallAsUtc - date.getTime();
}

/** Konversi jam dinding ET ("YYYY-MM-DD" + menit) menjadi Date (UTC). */
export function etWallToDate(dateISO: string, minutes: number): Date {
  const [year, month, day] = dateISO.split("-").map(Number);
  const wall = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 0, 0, 0) + minutes * 60_000;
  let guess = new Date(wall);
  for (let i = 0; i < 2; i += 1) {
    guess = new Date(wall - etOffsetMs(guess));
  }
  return guess;
}

export function hhmmToMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return 0;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return hour * 60 + minute;
}

export function minutesToHHMM(minutes: number): string {
  const safe = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function isTradingDay(dateISO: string): boolean {
  const [year, month, day] = dateISO.split("-").map(Number);
  const weekday = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !MARKET_HOLIDAYS.has(dateISO);
}

export function isEarlyClose(dateISO: string): boolean {
  return EARLY_CLOSES.has(dateISO);
}

export function closeMinutesFor(dateISO: string): number {
  return isEarlyClose(dateISO) ? EARLY_CLOSE_MINUTES : MARKET_CLOSE_MINUTES;
}

/** Tanggal bursa berikutnya (melewati akhir pekan & libur). */
export function nextTradingDay(dateISO: string): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const cursor = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  for (let i = 0; i < 20; i += 1) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const iso = cursor.toISOString().slice(0, 10);
    if (isTradingDay(iso)) return iso;
  }
  return dateISO;
}

/** Jam "flat by" efektif: maju ke 12.55 saat bursa tutup dini. */
export function flatByFor(dateISO: string, preferred: string): string {
  const preferredMinutes = hhmmToMinutes(preferred);
  if (isEarlyClose(dateISO)) {
    return minutesToHHMM(Math.min(preferredMinutes, EARLY_CLOSE_MINUTES - 5));
  }
  return minutesToHHMM(preferredMinutes);
}

const LABELS: Record<MarketState, string> = {
  premarket: "Pra-pasar",
  open: "Pasar buka",
  afterhours: "Pasca-pasar",
  closed: "Pasar tutup",
  weekend: "Akhir pekan",
  holiday: "Libur bursa",
};

function nextOpenStatus(
  state: MarketState,
  sessionDate: string,
  nowIso: string,
  detail: string,
): MarketStatus {
  const tradingDate = nextTradingDay(sessionDate);
  const open = etWallToDate(tradingDate, MARKET_OPEN_MINUTES);
  const close = etWallToDate(tradingDate, MARKET_CLOSE_MINUTES);
  return {
    state,
    label: LABELS[state],
    detail,
    sessionDate: tradingDate,
    isTradingDay: isTradingDay(tradingDate),
    earlyClose: false,
    openAt: open.toISOString(),
    closeAt: close.toISOString(),
    nowEt: nowIso,
    nextEvent: { at: open.toISOString(), label: "Bel pembukaan" },
  };
}

/** Status pasar pada waktu tertentu (default sekarang). */
export function marketStatus(now: Date = new Date()): MarketStatus {
  const parts = getEtParts(now);
  const dateISO = parts.dateISO;
  const hours = `${String(Math.floor(parts.minutes / 60)).padStart(2, "0")}:${String(
    parts.minutes % 60,
  ).padStart(2, "0")}`;

  if (!isTradingDay(dateISO)) {
    if (parts.weekday === 0 || parts.weekday === 6) {
      return nextOpenStatus("weekend", dateISO, parts.iso, `Akhir pekan. Buka lagi ${nextTradingDay(dateISO)} 09.30 ET.`);
    }
    return nextOpenStatus("holiday", dateISO, parts.iso, `Libur bursa (${dateISO}). Buka lagi ${nextTradingDay(dateISO)} 09.30 ET.`);
  }

  const closeMinutes = closeMinutesFor(dateISO);
  const open = etWallToDate(dateISO, MARKET_OPEN_MINUTES);
  const close = etWallToDate(dateISO, closeMinutes);
  const base = {
    sessionDate: dateISO,
    isTradingDay: true,
    earlyClose: closeMinutes !== MARKET_CLOSE_MINUTES,
    openAt: open.toISOString(),
    closeAt: close.toISOString(),
    nowEt: parts.iso,
  };
  const closeLabel = minutesToHHMM(closeMinutes);
  const detailOpen = `Sekarang ${hours} ET. Tutup ${closeLabel} ET.`;

  if (parts.minutes >= PREMARKET_MINUTES && parts.minutes < MARKET_OPEN_MINUTES) {
    return {
      ...base,
      state: "premarket",
      label: LABELS.premarket,
      detail: `Sekarang ${hours} ET. Bel buka 09.30 ET.${closeMinutes !== MARKET_CLOSE_MINUTES ? " Hari ini tutup dini 13.00 ET." : ""}`,
      nextEvent: { at: open.toISOString(), label: "Bel pembukaan" },
    };
  }
  if (parts.minutes >= MARKET_OPEN_MINUTES && parts.minutes < closeMinutes) {
    return {
      ...base,
      state: "open",
      label: LABELS.open,
      detail: detailOpen,
      nextEvent: { at: close.toISOString(), label: closeMinutes !== MARKET_CLOSE_MINUTES ? "Tutup dini" : "Bel penutupan" },
    };
  }
  if (parts.minutes >= closeMinutes && parts.minutes < AFTERHOURS_END_MINUTES) {
    const tomorrow = nextTradingDay(dateISO);
    const nextOpen = etWallToDate(tomorrow, MARKET_OPEN_MINUTES);
    return {
      ...base,
      state: "afterhours",
      label: LABELS.afterhours,
      detail: `Sekarang ${hours} ET. Sesi reguler sudah selesai (tutup ${closeLabel} ET).`,
      nextEvent: { at: nextOpen.toISOString(), label: "Bel pembukaan besok" },
    };
  }

  const tomorrow = nextTradingDay(dateISO);
  const nextOpen = etWallToDate(tomorrow, MARKET_OPEN_MINUTES);
  return {
    ...base,
    state: "closed",
    label: LABELS.closed,
    detail: `Sekarang ${hours} ET. Buka lagi ${tomorrow} 09.30 ET.`,
    nextEvent: { at: nextOpen.toISOString(), label: "Bel pembukaan" },
  };
}

/** Label jam ET pendek, mis. "10:15 ET". */
export function etTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = ET_PARTS.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")} ET`;
}

/** "YYYY-MM-DD" (ET) dari sebuah ISO. */
export function etDateOf(iso: string): string {
  return getEtParts(new Date(iso)).dateISO;
}

export const EARLY_CLOSE_WARNING =
  "Bursa tutup dini 13.00 ET — rencanakan keluar lebih awal (flat by 12.55 ET).";
