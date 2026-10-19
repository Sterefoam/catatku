/**
 * Utilitas tanggal. Semua tanggal transaksi disimpan sebagai "YYYY-MM-DD"
 * dan dihitung memakai zona waktu Asia/Jakarta.
 */

export const APP_TIME_ZONE = "Asia/Jakarta";

const DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
});

export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export const MONTHS_LONG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** "YYYY-MM-DD" hari ini di Asia/Jakarta. */
export function todayISO(date: Date = new Date()): string {
  return DAY_FORMATTER.format(date);
}

/** Jam sekarang "HH:mm" di Asia/Jakarta. */
export function nowTime(): string {
  return TIME_FORMATTER.format(new Date());
}

/** Jam saat ini (0-23) di Asia/Jakarta. */
export function currentHourJakarta(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  return Number.isFinite(hour) ? hour % 24 : 0;
}

/** Hari ini dalam kode mingguan: "mon" ... "sun". */
export function todayWeekday(): WeekdayKey {
  const short = WEEKDAY_FORMATTER.format(new Date()).toLowerCase();
  const map: Record<string, WeekdayKey> = {
    sun: "sun",
    mon: "mon",
    tue: "tue",
    wed: "wed",
    thu: "thu",
    fri: "fri",
    sat: "sat",
  };
  return map[short] ?? "mon";
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Pecah "YYYY-MM-DD" menjadi bagian angka. */
export function splitISODate(day: string): { year: number; month: number; day: number } {
  const [year, month, date] = day.split("-").map((part) => Number.parseInt(part, 10));
  return { year: year ?? 1970, month: month ?? 1, day: date ?? 1 };
}

export function toISODate(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Selisih hari (b - a), aman dari zona waktu. */
export function daysBetween(a: string, b: string): number {
  const first = Date.UTC(...toUTCParts(a));
  const second = Date.UTC(...toUTCParts(b));
  return Math.round((second - first) / 86_400_000);
}

function toUTCParts(day: string): [number, number, number] {
  const { year, month, day: date } = splitISODate(day);
  return [year, month - 1, date];
}

export function addDaysToISO(day: string, amount: number): string {
  const { year, month, day: date } = splitISODate(day);
  const next = new Date(Date.UTC(year, month - 1, date + amount));
  return toISODate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function weekdayOf(day: string): WeekdayKey {
  const { year, month, day: date } = splitISODate(day);
  const index = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return WEEKDAY_KEYS[index] ?? "mon";
}

/** Senin sebagai awal minggu. */
export function startOfWeekISO(day: string): string {
  const weekday = weekdayOf(day);
  const offset = weekday === "sun" ? 6 : WEEKDAY_KEYS.indexOf(weekday) - 1;
  return addDaysToISO(day, -offset);
}

export function startOfMonthISO(day: string): string {
  const { year, month } = splitISODate(day);
  return toISODate(year, month, 1);
}

export function endOfMonthISO(day: string): string {
  const { year, month } = splitISODate(day);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return addDaysToISO(toISODate(nextYear, nextMonth, 1), -1);
}

export function startOfYearISO(day: string): string {
  return toISODate(splitISODate(day).year, 1, 1);
}

export function endOfYearISO(day: string): string {
  return toISODate(splitISODate(day).year, 12, 31);
}

export function monthKey(day: string): string {
  return day.slice(0, 7);
}

export function monthLabel(key: string): string {
  const { year, month } = splitISODate(`${key}-01`);
  return `${MONTHS_LONG[month - 1]} ${year}`;
}

/** "Hari ini", "Kemarin", atau "12 Jan 2025". */
export function formatDayLabel(day: string, reference: string = todayISO()): string {
  const diff = daysBetween(day, reference);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  const { year, month, day: date } = splitISODate(day);
  const yearPart = year === splitISODate(reference).year ? ` ${year}` : ` ${year}`;
  return `${date} ${MONTHS_SHORT[month - 1]}${yearPart}`;
}

/** "19 Oktober 2026". */
export function formatDateLong(day: string): string {
  const { year, month, day: date } = splitISODate(day);
  return `${date} ${MONTHS_LONG[month - 1]} ${year}`;
}

/** "Sen, 19 Okt 2026". */
export function formatDateWithWeekday(day: string): string {
  const weekday = weekdayOf(day);
  const map: Record<WeekdayKey, string> = {
    mon: "Sen",
    tue: "Sel",
    wed: "Rab",
    thu: "Kam",
    fri: "Jum",
    sat: "Sab",
    sun: "Min",
  };
  return `${map[weekday]}, ${formatDayLabel(day)}`;
}

/** Nilai untuk <input type="date">. */
export function toDateInputValue(day: string): string {
  return day;
}

/** Jumlah hari dalam bulan dari "YYYY-MM". */
export function daysInMonth(key: string): number {
  const { year, month } = splitISODate(`${key}-01`);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export type RangeKey = "week" | "month" | "year";

export interface DateRange {
  key: RangeKey;
  start: string;
  end: string;
  label: string;
}

export function resolveRange(key: RangeKey, reference: string = todayISO()): DateRange {
  if (key === "week") {
    const start = startOfWeekISO(reference);
    return {
      key,
      start,
      end: addDaysToISO(start, 6),
      label: "Minggu ini",
    };
  }
  if (key === "year") {
    return {
      key,
      start: startOfYearISO(reference),
      end: endOfYearISO(reference),
      label: "Tahun ini",
    };
  }
  return {
    key,
    start: startOfMonthISO(reference),
    end: endOfMonthISO(reference),
    label: "Bulan ini",
  };
}

/** Cek tanggal ISO berada di rentang inklusif. */
export function isWithin(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}

/** Rentang tanggal untuk sekumpulan transaksi. */
export function earliestDate(dates: string[]): string | null {
  if (!dates.length) return null;
  return dates.reduce((min, value) => (value < min ? value : min), dates[0]!);
}
