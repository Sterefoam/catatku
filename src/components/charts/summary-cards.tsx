import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  totals: { income: number; expense: number; net: number };
  currency: string;
  rangeLabel: string;
}

type NetState = "surplus" | "defisit" | "seimbang";

const NET_COPY: Record<NetState, { label: string; tone: "success" | "danger" | "neutral"; hint: string }> = {
  surplus: { label: "Surplus", tone: "success", hint: "Uang masuk lebih besar" },
  defisit: { label: "Defisit", tone: "danger", hint: "Uang keluar lebih besar" },
  seimbang: { label: "Seimbang", tone: "neutral", hint: "Masuk dan keluar sama" },
};

/** Kartu ringkasan: pemasukan, pengeluaran, dan selisih pada rentang terpilih. */
export function SummaryCards({ totals, currency, rangeLabel }: SummaryCardsProps) {
  const netState: NetState = totals.net > 0 ? "surplus" : totals.net < 0 ? "defisit" : "seimbang";
  const netCopy = NET_COPY[netState];

  return (
    <section aria-label={`Ringkasan total ${rangeLabel}`} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-success-soft text-success">
            <ArrowDownLeft className="size-4" aria-hidden="true" />
          </span>
          <p className="text-[12px] font-medium text-muted-foreground">Pemasukan</p>
        </div>
        <p className="money mt-2.5 truncate text-[17px] font-bold leading-tight text-success sm:text-[19px]">
          {formatMoney(totals.income, currency)}
        </p>
        <p className="mt-0.5 text-[10.5px] text-muted-foreground">{rangeLabel}</p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </span>
          <p className="text-[12px] font-medium text-muted-foreground">Pengeluaran</p>
        </div>
        <p className="money mt-2.5 truncate text-[17px] font-bold leading-tight text-danger sm:text-[19px]">
          {formatMoney(totals.expense, currency)}
        </p>
        <p className="mt-0.5 text-[10.5px] text-muted-foreground">{rangeLabel}</p>
      </Card>

      <Card className="col-span-2 p-4 sm:col-span-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-xl",
              netState === "defisit" ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary",
            )}
          >
            <Scale className="size-4" aria-hidden="true" />
          </span>
          <p className="text-[12px] font-medium text-muted-foreground">Selisih</p>
          <Badge tone={netCopy.tone} className="ml-auto">
            {netCopy.label}
          </Badge>
        </div>
        <p
          className={cn(
            "money mt-2.5 truncate text-[17px] font-bold leading-tight sm:text-[19px]",
            netState === "surplus" && "text-success",
            netState === "defisit" && "text-danger",
            netState === "seimbang" && "text-muted-foreground",
          )}
        >
          {formatMoney(Math.abs(totals.net), currency)}
        </p>
        <p className="mt-0.5 text-[10.5px] text-muted-foreground">{netCopy.hint}</p>
      </Card>
    </section>
  );
}
