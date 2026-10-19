import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import type { ChartBucketDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const PLOT_HEIGHT = "h-[9.75rem] sm:h-52";

interface IncomeExpenseChartProps {
  series: ChartBucketDTO[];
  totals: { income: number; expense: number; net: number };
  currency: string;
  rangeLabel: string;
  periodLabel: string;
}

function ChartBar({
  value,
  max,
  tone,
  label,
}: {
  value: number;
  max: number;
  tone: "income" | "expense";
  label: string;
}) {
  const ratio = max > 0 ? (value / max) * 100 : 0;
  const height = value > 0 ? `${Math.max(ratio, 2.5)}%` : "2px";

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "w-[42%] max-w-[1.15rem] rounded-t-[3px] transition-[height] duration-300",
        tone === "income" ? "bg-success" : "bg-danger",
        value === 0 && "opacity-20",
      )}
      style={{ height }}
    />
  );
}

/** Grafik batang berdampingan: pemasukan (hijau) vs pengeluaran (merah) per bucket. */
export function IncomeExpenseChart({
  series,
  totals,
  currency,
  rangeLabel,
  periodLabel,
}: IncomeExpenseChartProps) {
  const maxValue = series.reduce((max, bucket) => Math.max(max, bucket.income, bucket.expense), 0);
  const maxLabel = formatMoneyCompact(maxValue, currency);
  const midLabel = formatMoneyCompact(Math.round(maxValue / 2), currency);
  const missingIncome = totals.income <= 0 && totals.expense > 0;
  const missingExpense = totals.expense <= 0 && totals.income > 0;
  const missingNote = missingIncome
    ? "Belum ada pemasukan pada periode ini — batang pemasukan bernilai nol."
    : missingExpense
      ? "Belum ada pengeluaran pada periode ini — batang pengeluaran bernilai nol."
      : null;

  return (
    <Card className="p-4 sm:p-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight">Masuk vs keluar</h2>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {rangeLabel} · {periodLabel}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-success" />
          Pemasukan
          <span className="money font-bold text-success">
            {formatMoney(totals.income, currency)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-danger" />
          Pengeluaran
          <span className="money font-bold text-danger">
            {formatMoney(totals.expense, currency)}
          </span>
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <div
          className={cn(
            "flex w-11 shrink-0 flex-col justify-between text-right text-[9px] leading-none text-muted-foreground",
            PLOT_HEIGHT,
          )}
          aria-hidden="true"
        >
          <span className="money">{maxLabel}</span>
          <span className="money">{midLabel}</span>
          <span className="money">0</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className={cn("relative", PLOT_HEIGHT)}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex flex-col justify-between"
            >
              <span className="block h-px w-full bg-border/80" />
              <span className="block h-px w-full bg-border/50" />
              <span className="block h-px w-full bg-border/80" />
            </div>

            <div className="absolute inset-0 flex items-end gap-[2px] sm:gap-1">
              {series.map((bucket) => (
                <div
                  key={bucket.key}
                  className="flex h-full min-w-0 flex-1 items-end justify-center gap-[3px]"
                >
                  <ChartBar
                    value={bucket.income}
                    max={maxValue}
                    tone="income"
                    label={`${bucket.label}, pemasukan ${formatMoney(bucket.income, currency)}`}
                  />
                  <ChartBar
                    value={bucket.expense}
                    max={maxValue}
                    tone="expense"
                    label={`${bucket.label}, pengeluaran ${formatMoney(bucket.expense, currency)}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-1.5 flex gap-[2px] sm:gap-1" aria-hidden="true">
            {series.map((bucket) => (
              <span
                key={bucket.key}
                className="min-w-0 flex-1 truncate text-center text-[9px] font-medium leading-none text-muted-foreground sm:text-[10.5px]"
              >
                {bucket.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {missingNote ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-muted/60 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {missingNote}
        </p>
      ) : null}

      {/* Tabel ringkasan untuk pembaca layar. Wrapper div wajib: <table>
          dengan sr-only tetap punya lebar intrinsik dan bisa melebarkan halaman. */}
      <div className="sr-only">
        <table>
          <caption>
            Ringkasan pemasukan dan pengeluaran {rangeLabel}, {periodLabel}
          </caption>
          <thead>
            <tr>
              <th scope="col">Periode</th>
              <th scope="col">Pemasukan</th>
              <th scope="col">Pengeluaran</th>
            </tr>
          </thead>
          <tbody>
            {series.map((bucket) => (
              <tr key={bucket.key}>
                <th scope="row">{bucket.label}</th>
                <td>{formatMoney(bucket.income, currency)}</td>
                <td>{formatMoney(bucket.expense, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
