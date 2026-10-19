import { WEEKDAYS } from "@/lib/constants";

/** Kode hari yang dipakai API pengingat: "mon" ... "sun". */
export type ReminderDay = (typeof WEEKDAYS)[number]["key"];

export const ALL_DAYS: ReminderDay[] = WEEKDAYS.map((day) => day.key);

export const WORK_DAYS: ReminderDay[] = ["mon", "tue", "wed", "thu", "fri"];

const DAY_LABEL: Record<ReminderDay, string> = {
  mon: "Sen",
  tue: "Sel",
  wed: "Rab",
  thu: "Kam",
  fri: "Jum",
  sat: "Sab",
  sun: "Min",
};

const DAY_FULL: Record<ReminderDay, string> = {
  mon: "Senin",
  tue: "Selasa",
  wed: "Rabu",
  thu: "Kamis",
  fri: "Jumat",
  sat: "Sabtu",
  sun: "Minggu",
};

export function dayLabel(day: ReminderDay): string {
  return DAY_LABEL[day];
}

export function dayFullLabel(day: ReminderDay): string {
  return DAY_FULL[day];
}

/** Buang hari tak dikenal dan urutkan Senin → Minggu. */
export function normalizeDays(days: readonly string[]): ReminderDay[] {
  return ALL_DAYS.filter((day) => days.includes(day));
}

/** Apakah dua daftar hari berisi hari yang sama (urutan diabaikan). */
export function sameDays(a: readonly string[], b: readonly string[]): boolean {
  return normalizeDays(a).join(",") === normalizeDays(b).join(",");
}

/** "20:00" → "20.00" (gaya jam Indonesia untuk teks). */
export function formatReminderTime(time: string): string {
  return time.replace(":", ".");
}

/** "Setiap hari" | "Hari kerja" | "Senin, Rabu" | "Belum ada hari dipilih". */
export function describeDays(days: readonly string[]): string {
  const normalized = normalizeDays(days);
  if (normalized.length === 0) return "Belum ada hari dipilih";
  if (normalized.length === ALL_DAYS.length) return "Setiap hari";
  if (
    normalized.length === WORK_DAYS.length &&
    WORK_DAYS.every((day) => normalized.includes(day))
  ) {
    return "Hari kerja";
  }
  return normalized.map(dayFullLabel).join(", ");
}

/**
 * Ringkasan status jadwal untuk ditampilkan di kartu:
 * "Aktif setiap hari pukul 20.00" / "Nonaktif".
 */
export function describeSchedule({
  time,
  days,
  isActive,
}: {
  time: string;
  days: readonly string[];
  isActive: boolean;
}): string {
  if (!isActive) return "Nonaktif";
  const dayText = describeDays(days);
  const lower =
    dayText === "Setiap hari"
      ? "setiap hari"
      : dayText === "Hari kerja"
        ? "hari kerja"
        : dayText;
  return `Aktif ${lower} pukul ${formatReminderTime(time)}`;
}

/** Ringkasan ringkas untuk pratinjau: "Setiap hari · pukul 20.00". */
export function describeScheduleShort({
  time,
  days,
  isActive,
}: {
  time: string;
  days: readonly string[];
  isActive: boolean;
}): string {
  if (!isActive) return "Jadwal nonaktif";
  return `${describeDays(days)} · pukul ${formatReminderTime(time)}`;
}
