import { MONTHS_SHORT, splitISODate, type RangeKey } from "@/lib/date";

/**
 * Label periode yang ramah dibaca, mis. "1 – 31 Okt 2026",
 * "29 Sep – 5 Okt 2026", atau "2026" untuk rentang tahunan.
 */
export function formatPeriodLabel(start: string, end: string, range: RangeKey): string {
  const first = splitISODate(start);
  const last = splitISODate(end);

  if (range === "year") return String(first.year);

  const firstDay = `${first.day} ${MONTHS_SHORT[first.month - 1]}`;
  const lastDay = `${last.day} ${MONTHS_SHORT[last.month - 1]} ${last.year}`;
  return `${firstDay} \u2013 ${lastDay}`;
}
