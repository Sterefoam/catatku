"use client";

import { dailyTotals } from "@/lib/analytics";
import { formatDayLabel } from "@/lib/date";
import { MINUS, formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/card";
import type { TransactionDTO } from "@/lib/types";
import { HistoryRow } from "./history-row";

/** Kelompok transaksi satu tanggal + total masuk/keluar hari itu. */
export function HistoryGroup({
  date,
  transactions,
  currency,
  today,
}: {
  date: string;
  transactions: TransactionDTO[];
  currency: string;
  today: string;
}) {
  const { income, expense } = dailyTotals(transactions);
  const label = formatDayLabel(date, today);

  return (
    <section aria-label={`Transaksi ${label}`} className="animate-rise">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13.5px] font-bold tracking-tight">{label}</h2>
          <span className="text-[11px] text-muted-foreground">
            {transactions.length} transaksi
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] font-semibold">
          <span
            className={income > 0 ? "money text-success" : "money text-muted-foreground/70"}
            aria-label={`Total pemasukan ${formatMoney(income, currency)}`}
          >
            +{formatMoney(income, currency)}
          </span>
          <span
            className={expense > 0 ? "money text-danger" : "money text-muted-foreground/70"}
            aria-label={`Total pengeluaran ${formatMoney(expense, currency)}`}
          >
            {MINUS}
            {formatMoney(expense, currency)}
          </span>
        </div>
      </div>

      <Card className="overflow-hidden p-1.5">
        <div className="divide-y divide-border/60">
          {transactions.map((transaction) => (
            <HistoryRow
              key={transaction.id}
              transaction={transaction}
              currency={currency}
            />
          ))}
        </div>
      </Card>
    </section>
  );
}
