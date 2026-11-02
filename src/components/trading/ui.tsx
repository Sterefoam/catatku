"use client";

/**
 * Komponen kecil bersama modul Trading (dipakai dashboard, scanner,
 * inspeksi, dan meja transaksi). Jangan diubah tanpa koordinasi Lead.
 */

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bar, MarketStatus, RiskCheckItem, SetupTag } from "@/lib/trading/types";
import { fmtPct } from "@/lib/trading/format";

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export function Sparkline({
  bars,
  className,
  height = 56,
  strokeWidth = 2,
  showArea = true,
}: {
  bars: number[] | Bar[];
  className?: string;
  height?: number;
  strokeWidth?: number;
  showArea?: boolean;
}) {
  const values = React.useMemo(() => {
    if (!bars.length) return [];
    const first = bars[0];
    if (typeof first === "number") return bars as number[];
    return (bars as Bar[]).map((bar) => bar.c);
  }, [bars]);

  if (values.length < 2) {
    return (
      <div
        className={cn("flex items-center justify-center rounded-xl bg-muted/50 text-[11px] text-muted-foreground", className)}
        style={{ height }}
      >
        Belum ada grafik
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = 100 / (values.length - 1);
  const points = values.map((value, index) => {
    const x = index * stepX;
    const y = 96 - ((value - min) / span) * 92;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const path = `M${points.join(" L")}`;
  const area = `${path} L100,100 L0,100 Z`;
  const up = values[values.length - 1]! >= values[0]!;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("w-full", up ? "text-success" : "text-danger", className)}
      style={{ height }}
      role="img"
      aria-label={up ? "Grafik naik" : "Grafik turun"}
    >
      {showArea ? <path d={area} fill="currentColor" opacity="0.1" /> : null}
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Perubahan harga                                                     */
/* ------------------------------------------------------------------ */

export function PriceChange({
  change,
  changePct,
  className,
  showAmount = false,
}: {
  change?: number | null;
  changePct?: number | null;
  className?: string;
  showAmount?: boolean;
}) {
  const pct = changePct ?? null;
  const positive = (pct ?? 0) >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[12.5px] font-semibold",
        positive ? "text-success" : "text-danger",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {fmtPct(pct)}
      {showAmount && change !== undefined && change !== null ? (
        <span className="text-[11px] font-medium opacity-80">
          ({change >= 0 ? "+" : "−"}${Math.abs(change / 100).toFixed(2)})
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Kartu statistik kecil                                               */
/* ------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "success" | "danger" | "warning";
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-surface/40 px-3.5 py-3", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "money mt-1 text-[17px] font-bold leading-tight",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badge status pasar                                                  */
/* ------------------------------------------------------------------ */

const MARKET_TONE: Record<MarketStatus["state"], string> = {
  open: "text-success",
  premarket: "text-warning",
  afterhours: "text-warning",
  closed: "text-muted-foreground",
  weekend: "text-muted-foreground",
  holiday: "text-muted-foreground",
};

export function MarketBadge({ market }: { market: MarketStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-semibold">
      <Circle
        className={cn("size-2 fill-current", MARKET_TONE[market.state])}
        aria-hidden="true"
      />
      <span className={MARKET_TONE[market.state]}>{market.label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Label setup                                                         */
/* ------------------------------------------------------------------ */

export function SetupPill({ setup, className }: { setup: SetupTag; className?: string }) {
  return (
    <span
      title={setup.detail}
      className={cn(
        "inline-flex items-center rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary",
        className,
      )}
    >
      {setup.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Daftar cek risiko                                                   */
/* ------------------------------------------------------------------ */

export function RiskCheckList({ checks }: { checks: RiskCheckItem[] }) {
  if (!checks.length) return null;
  return (
    <ul className="space-y-1.5">
      {checks.map((check) => (
        <li key={check.id} className="flex items-start gap-2 text-[12.5px]">
          <span
            className={cn(
              "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
              check.status === "pass" && "bg-success",
              check.status === "fail" && "bg-danger",
              check.status === "warn" && "bg-warning",
            )}
            aria-hidden="true"
          >
            {check.status === "pass" ? "✓" : check.status === "fail" ? "×" : "!"}
          </span>
          <span>
            <span className="font-semibold">{check.label}</span>
            <span className="text-muted-foreground"> — {check.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Judul bagian                                                        */
/* ------------------------------------------------------------------ */

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[16px] font-bold tracking-tight sm:text-[17px]">{title}</h2>
        {hint ? <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Catatan kecil bahwa data gratis & bisa tertunda. */
export function DataHint({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      {children ?? "Harga & berita dari Yahoo Finance (gratis, bisa tertunda). Bukan saran finansial."}
    </p>
  );
}

/**
 * Bagian yang bisa dibuka-tutup. Dipakai untuk memisahkan hal penting
 * (selalu terlihat) dari detail lanjutan supaya halaman tidak ramai.
 */
export function Disclosure({
  title,
  hint,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      className={cn(
        "group rounded-3xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(16,32,26,0.04),0_14px_34px_-22px_rgba(16,32,26,0.22)]",
        className,
      )}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <ChevronDown
            className="size-4 transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold">{title}</span>
          {hint ? (
            <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="border-t border-border/70 px-4 pb-4 pt-3.5">{children}</div>
    </details>
  );
}
