"use client";

import * as React from "react";
import { ArrowDownLeft, BarChart3, Plus } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { buildCharts } from "@/lib/analytics";
import { todayISO, type RangeKey } from "@/lib/date";
import type { TransactionDTO } from "@/lib/types";
import { CategorySpendingChart } from "./category-spending-chart";
import { formatPeriodLabel } from "./format-period";
import { IncomeExpenseChart } from "./income-expense-chart";
import { SummaryCards } from "./summary-cards";

const RANGE_OPTIONS: SegmentedOption<RangeKey>[] = [
  { value: "week", label: "Minggu ini" },
  { value: "month", label: "Bulan ini" },
  { value: "year", label: "Tahun ini" },
];

export function GrafikView({
  transactions,
  currency,
  initialRange = "month",
}: {
  transactions: TransactionDTO[];
  currency: string;
  initialRange?: RangeKey;
}) {
  const { openCreate } = useApp();
  const [range, setRange] = React.useState<RangeKey>(initialRange);
  const [showAllCategories, setShowAllCategories] = React.useState(false);

  // Referensi tanggal dikunci saat mount agar tampilan tidak berkedip saat render ulang.
  const reference = React.useMemo(() => todayISO(), []);
  const charts = React.useMemo(
    () => buildCharts(transactions, range, reference),
    [transactions, range, reference],
  );

  const periodLabel = formatPeriodLabel(charts.start, charts.end, range);
  const rangeEmpty = charts.totals.income === 0 && charts.totals.expense === 0;
  const noDataAtAll = transactions.length === 0;

  function handleRangeChange(next: RangeKey) {
    setRange(next);
    setShowAllCategories(false);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Grafik uang"
        subtitle="Pola uang masuk dan keluar dalam sekali lihat."
      />

      <section aria-label="Pilih rentang waktu" className="space-y-2">
        <Segmented
          value={range}
          onChange={handleRangeChange}
          options={RANGE_OPTIONS}
          ariaLabel="Pilih rentang waktu grafik"
        />
        <p className="text-center text-[11.5px] text-muted-foreground">
          Menampilkan{" "}
          <span className="font-semibold text-foreground">{charts.label.toLowerCase()}</span> ·{" "}
          {periodLabel}
        </p>
      </section>

      <SummaryCards totals={charts.totals} currency={currency} rangeLabel={charts.label} />

      {rangeEmpty ? (
        <EmptyState
          icon={<BarChart3 className="size-6" aria-hidden="true" />}
          title={
            noDataAtAll
              ? "Belum ada transaksi"
              : `Belum ada transaksi ${charts.label.toLowerCase()}`
          }
          description={
            noDataAtAll
              ? "Catat pemasukan atau pengeluaran pertamamu. Grafik akan terisi otomatis di sini."
              : `Tidak ada catatan pada ${periodLabel}. Coba pilih rentang lain atau catat transaksi baru.`
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="md" onClick={() => openCreate("expense")}>
                <Plus className="size-4" aria-hidden="true" /> Catat pengeluaran
              </Button>
              <Button size="md" variant="outline" onClick={() => openCreate("income")}>
                <ArrowDownLeft className="size-4" aria-hidden="true" /> Catat pemasukan
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <IncomeExpenseChart
            series={charts.series}
            totals={charts.totals}
            currency={currency}
            rangeLabel={charts.label}
            periodLabel={periodLabel}
          />

          <CategorySpendingChart
            categories={charts.categories}
            currency={currency}
            rangeLabel={charts.label}
            periodLabel={periodLabel}
            showAll={showAllCategories}
            onToggleShowAll={() => setShowAllCategories((current) => !current)}
          />
        </>
      )}
    </div>
  );
}
