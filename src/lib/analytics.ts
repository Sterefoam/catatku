import {
  MONTHS_SHORT,
  WEEKDAY_KEYS,
  daysInMonth,
  resolveRange,
  splitISODate,
  startOfWeekISO,
  addDaysToISO,
  todayISO,
  type RangeKey,
} from "./date";
import type {
  CategorySliceDTO,
  ChartBucketDTO,
  ChartsDTO,
  TransactionDTO,
  TxType,
} from "./types";

export const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function isInRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}

export function filterByRange(
  transactions: TransactionDTO[],
  start: string,
  end: string,
): TransactionDTO[] {
  return transactions.filter((tx) => isInRange(tx.date, start, end));
}

export function totalsOf(transactions: TransactionDTO[]): {
  income: number;
  expense: number;
  net: number;
} {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === "income") income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense, net: income - expense };
}

export function totalByType(transactions: TransactionDTO[], type: TxType): number {
  return transactions.reduce((sum, tx) => (tx.type === type ? sum + tx.amount : sum), 0);
}

/** Bucket grafik: minggu = 7 hari, bulan = per pekan, tahun = per bulan. */
export function buildSeries(
  transactions: TransactionDTO[],
  range: RangeKey,
  start: string,
  end: string,
): ChartBucketDTO[] {
  const buckets: ChartBucketDTO[] = [];

  if (range === "week") {
    const weekStart = startOfWeekISO(start);
    for (let index = 0; index < 7; index += 1) {
      const day = addDaysToISO(weekStart, index);
      if (day > end) break;
      const dayTx = transactions.filter((tx) => tx.date === day);
      const label = WEEKDAY_LABELS[index] ?? day;
      buckets.push({
        key: day,
        label,
        income: totalByType(dayTx, "income"),
        expense: totalByType(dayTx, "expense"),
      });
    }
    return buckets;
  }

  if (range === "month") {
    const { year, month } = splitISODate(start);
    const totalDays = daysInMonth(`${year}-${String(month).padStart(2, "0")}`);
    let cursor = 1;
    while (cursor <= totalDays) {
      const bucketStartDay = cursor;
      const bucketEndDay = Math.min(cursor + 6, totalDays);
      const bucketStart = `${year}-${String(month).padStart(2, "0")}-${String(bucketStartDay).padStart(2, "0")}`;
      const bucketEnd = `${year}-${String(month).padStart(2, "0")}-${String(bucketEndDay).padStart(2, "0")}`;
      const bucketTx = transactions.filter((tx) => isInRange(tx.date, bucketStart, bucketEnd));
      buckets.push({
        key: bucketStart,
        label: `${bucketStartDay}–${bucketEndDay}`,
        income: totalByType(bucketTx, "income"),
        expense: totalByType(bucketTx, "expense"),
      });
      cursor += 7;
    }
    return buckets;
  }

  const { year } = splitISODate(start);
  for (let month = 1; month <= 12; month += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const bucketTx = transactions.filter((tx) => tx.date.startsWith(key));
    buckets.push({
      key,
      label: MONTHS_SHORT[month - 1] ?? key,
      income: totalByType(bucketTx, "income"),
      expense: totalByType(bucketTx, "expense"),
    });
  }
  return buckets;
}

/** Rincian pengeluaran per kategori pada rentang tertentu. */
export function categoryBreakdown(
  transactions: TransactionDTO[],
  start: string,
  end: string,
): CategorySliceDTO[] {
  const expenses = filterByRange(transactions, start, end).filter(
    (tx) => tx.type === "expense",
  );
  const total = expenses.reduce((sum, tx) => sum + tx.amount, 0);
  const grouped = new Map<string, CategorySliceDTO>();

  for (const tx of expenses) {
    const existing = grouped.get(tx.categoryId);
    if (existing) {
      existing.total += tx.amount;
    } else {
      grouped.set(tx.categoryId, {
        categoryId: tx.categoryId,
        name: tx.category.name,
        icon: tx.category.icon,
        color: tx.category.color,
        total: tx.amount,
        share: 0,
      });
    }
  }

  const slices = [...grouped.values()].sort((a, b) => b.total - a.total);
  for (const slice of slices) {
    slice.share = total > 0 ? Math.round((slice.total / total) * 100) : 0;
  }
  return slices;
}

export function buildCharts(
  transactions: TransactionDTO[],
  range: RangeKey,
  reference: string = todayISO(),
): ChartsDTO {
  const resolved = resolveRange(range, reference);
  const inRange = filterByRange(transactions, resolved.start, resolved.end);
  return {
    range,
    start: resolved.start,
    end: resolved.end,
    label: resolved.label,
    totals: totalsOf(inRange),
    series: buildSeries(transactions, range, resolved.start, resolved.end),
    categories: categoryBreakdown(transactions, resolved.start, resolved.end),
  };
}

/** Total masuk/keluar per hari untuk header grup riwayat. */
export function dailyTotals(transactions: TransactionDTO[]): {
  income: number;
  expense: number;
} {
  return {
    income: totalByType(transactions, "income"),
    expense: totalByType(transactions, "expense"),
  };
}

export function weekdayLabel(day: string): string {
  const weekday = WEEKDAY_KEYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
  const map: Record<string, string> = {
    mon: "Sen",
    tue: "Sel",
    wed: "Rab",
    thu: "Kam",
    fri: "Jum",
    sat: "Sab",
    sun: "Min",
  };
  return map[weekday ?? "mon"] ?? "";
}
