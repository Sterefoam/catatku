"use client";

import Link from "next/link";
import { ArrowRight, Target, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { formatMoney } from "@/lib/money";
import type { BudgetUsageDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  BudgetUsageDTO["status"],
  {
    label: string;
    badge: "outline" | "success" | "warning" | "danger";
    progress: "primary" | "success" | "warning" | "danger";
  }
> = {
  none: { label: "Belum diatur", badge: "outline", progress: "primary" },
  safe: { label: "Aman", badge: "success", progress: "primary" },
  warning: { label: "Mendekati 80%", badge: "warning", progress: "warning" },
  over: { label: "Terlewati", badge: "danger", progress: "danger" },
};

/**
 * Kartu "Pengingat batas belanja": sakelar peringatan + ringkasan pemakaian
 * batas belanja bulan ini (spent vs limit, progress, status).
 */
export function BudgetAlertCard({
  usage,
  currency,
  enabled,
  saving,
  onToggle,
}: {
  usage: BudgetUsageDTO;
  currency: string;
  enabled: boolean;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const hasBudget = Boolean(usage.budget);
  const limit = usage.budget?.limitAmount ?? 0;
  const meta = STATUS_META[usage.status];
  const isNearLimit = usage.status === "warning" || usage.status === "over";

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <Target className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-semibold">Pengingat batas belanja</p>
              <Badge tone={enabled ? "success" : "neutral"}>
                {enabled ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              Ingatkan saat pengeluaran mendekati batas bulanan (mulai 80%).
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={saving}
            aria-label="Aktifkan pengingat batas belanja"
            className="mt-0.5"
          />
        </div>
      </div>

      <div className="space-y-3.5 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-muted-foreground">
            Pengeluaran {usage.periodLabel}
          </p>
          <Badge tone={meta.badge}>{meta.label}</Badge>
        </div>

        {hasBudget ? (
          <>
            <div>
              <p className="money text-[23px] font-bold leading-tight">
                {formatMoney(usage.spent, currency)}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                dari batas {formatMoney(limit, currency)}
              </p>
            </div>

            <Progress value={usage.percent} tone={meta.progress} />

            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span
                className={cn(
                  "font-semibold",
                  usage.status === "over"
                    ? "text-danger"
                    : usage.status === "warning"
                      ? "text-warning"
                      : "text-muted-foreground",
                )}
              >
                {usage.percent}% terpakai
              </span>
              <span className="text-muted-foreground">
                {usage.remaining >= 0
                  ? `Sisa ${formatMoney(usage.remaining, currency)}`
                  : `Lewat ${formatMoney(Math.abs(usage.remaining), currency)}`}
              </span>
            </div>

            {isNearLimit ? (
              <p
                className={cn(
                  "flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed",
                  usage.status === "over"
                    ? "bg-danger-soft text-danger"
                    : "bg-warning-soft text-warning",
                )}
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {enabled
                    ? usage.status === "over"
                      ? `Pengeluaranmu sudah melewati batas ${formatMoney(limit, currency)}. Coba tahan belanja non-esensial sampai bulan depan.`
                      : `Sudah ${usage.percent}% dari batas. Sisa ${formatMoney(usage.remaining, currency)} untuk sisa bulan ini.`
                    : "Peringatan sedang dimatikan. Nyalakan sakelar di atas supaya kamu diingatkan saat mendekati batas."}
                </span>
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <p className="text-[11px] text-muted-foreground">
                Atur atau ubah batas dari halaman Target.
              </p>
              <Link
                href="/target"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-10")}
              >
                Ubah batas <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Bulan ini kamu sudah mencatat pengeluaran sebesar{" "}
              <span className="money font-semibold text-foreground">
                {formatMoney(usage.spent, currency)}
              </span>
              . Tentukan batas bulanan supaya Catatku bisa membandingkan pemakaian dan
              mengingatkanmu saat mendekati batas.
            </p>
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-4">
              <p className="text-[13px] font-semibold">Belum ada batas belanja bulan ini</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Pasang pagar pengeluaran supaya peringatan otomatis bisa berjalan.
              </p>
              <Link
                href="/target"
                className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-3")}
              >
                Atur batas belanja <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
