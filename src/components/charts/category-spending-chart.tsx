import { ChevronDown, ChevronUp, PieChart } from "lucide-react";
import { CategoryBadge } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { CategorySliceDTO } from "@/lib/types";

const MAX_VISIBLE = 6;

interface CategorySpendingChartProps {
  categories: CategorySliceDTO[];
  currency: string;
  rangeLabel: string;
  periodLabel: string;
  showAll: boolean;
  onToggleShowAll: () => void;
}

/** Daftar bar horizontal pengeluaran per kategori, urut terbesar. */
export function CategorySpendingChart({
  categories,
  currency,
  rangeLabel,
  periodLabel,
  showAll,
  onToggleShowAll,
}: CategorySpendingChartProps) {
  const totalSpent = categories.reduce((sum, slice) => sum + slice.total, 0);
  const visible = showAll ? categories : categories.slice(0, MAX_VISIBLE);
  const hiddenCount = categories.length - MAX_VISIBLE;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">Pengeluaran per kategori</h2>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {rangeLabel} · {periodLabel}
          </p>
        </div>
        {categories.length > 0 ? (
          <div className="shrink-0 text-right">
            <p className="text-[10.5px] text-muted-foreground">Total</p>
            <p className="money text-[13px] font-bold leading-tight">
              {formatMoney(totalSpent, currency)}
            </p>
          </div>
        ) : null}
      </div>

      {categories.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <PieChart className="size-5" aria-hidden="true" />
          </span>
          <p className="text-[13.5px] font-semibold">Belum ada pengeluaran</p>
          <p className="max-w-[16rem] text-[12px] leading-relaxed text-muted-foreground">
            Pada {periodLabel} belum ada pengeluaran yang tercatat. Grafik kategori akan
            terisi otomatis setelah kamu mencatatnya.
          </p>
        </div>
      ) : (
        <>
          <ol className="mt-3 space-y-3.5">
            {visible.map((slice) => {
              const width = totalSpent > 0 ? Math.max((slice.total / totalSpent) * 100, 2) : 0;
              return (
                <li key={slice.categoryId}>
                  <div className="flex items-center gap-3">
                    <CategoryBadge icon={slice.icon} color={slice.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[13px] font-semibold">{slice.name}</p>
                        <p className="money shrink-0 text-[12.5px] font-bold">
                          {formatMoney(slice.total, currency)}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div
                          role="progressbar"
                          aria-label={`${slice.name}, ${slice.share}% dari total pengeluaran`}
                          aria-valuenow={slice.share}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                        >
                          <div
                            className="h-full rounded-full transition-[width] duration-300"
                            style={{ width: `${width}%`, backgroundColor: slice.color }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                          {slice.share}%
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {hiddenCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
              onClick={onToggleShowAll}
              aria-expanded={showAll}
            >
              {showAll ? (
                <>
                  <ChevronUp className="size-4" aria-hidden="true" /> Ringkas daftar
                </>
              ) : (
                <>
                  <ChevronDown className="size-4" aria-hidden="true" /> Lihat semua (
                  {categories.length})
                </>
              )}
            </Button>
          ) : null}
        </>
      )}
    </Card>
  );
}
