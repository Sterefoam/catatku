"use client";

/**
 * Panel berita & 8-K di halaman Inspeksi Saham.
 * Data dikirim dari server component; default tampil 3 item teratas, sisanya
 * bisa dibuka lewat tombol "Lihat semua". Tombol "Muat ulang" memakai
 * router.refresh.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  FileText,
  Newspaper,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionTitle } from "@/components/trading/ui";
import { fmtDate, fmtEtDateTime } from "@/lib/trading/format";
import type { NewsItem } from "@/lib/trading/types";
import { cn } from "@/lib/utils";

type BadgeTone = React.ComponentProps<typeof Badge>["tone"];

const TOP_COUNT = 3;

/** Headline memakai jam ET; filing SEC hanya tanggal (jam filing tidak tersedia). */
function publishedLabel(item: NewsItem): string {
  if (item.kind === "filing") return `diajukan ${fmtDate(item.publishedAt)}`;
  return fmtEtDateTime(item.publishedAt);
}

const TAG_META: Record<string, { label: string; tone: BadgeTone }> = {
  moving: { label: "Harga bergerak", tone: "warning" },
  earnings: { label: "Laba", tone: "primary" },
  analyst: { label: "Analis", tone: "neutral" },
  deal: { label: "Kesepakatan", tone: "primary" },
  halt: { label: "Dihentikan", tone: "danger" },
  regulatory: { label: "Regulasi", tone: "warning" },
  macro: { label: "Ekonomi", tone: "neutral" },
  capital: { label: "Modal", tone: "neutral" },
  people: { label: "Manajemen", tone: "neutral" },
  risk: { label: "Risiko", tone: "danger" },
  sec: { label: "SEC", tone: "outline" },
  filing: { label: "8-K", tone: "outline" },
};

function NewsRow({ item }: { item: NewsItem }) {
  const Icon = item.kind === "filing" ? FileText : Newspaper;
  const tags = item.tags.slice(0, 4);
  return (
    <li
      className={cn(
        "rounded-2xl border px-3.5 py-3",
        item.important ? "border-danger/40 bg-danger-soft/40" : "border-border/70 bg-surface/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate font-medium">{item.source}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.publishedAt} className="shrink-0">
            {publishedLabel(item)}
          </time>
        </div>
        {item.important ? (
          <Badge tone="danger" className="shrink-0">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Penting
          </Badge>
        ) : null}
      </div>

      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 block text-[13.5px] font-semibold leading-snug transition-colors hover:text-primary hover:underline"
      >
        {item.title}
        <ExternalLink className="ml-1 inline size-3 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only"> (buka di tab baru)</span>
      </a>

      {item.summary ? (
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
          {item.summary}
        </p>
      ) : null}

      {tags.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const meta = TAG_META[tag];
            return (
              <Badge key={tag} tone={meta?.tone ?? "neutral"}>
                {meta?.label ?? tag}
              </Badge>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}

export function NewsPanel({
  symbol,
  items,
  hours,
}: {
  symbol: string;
  items: NewsItem[];
  hours: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [expanded, setExpanded] = React.useState(false);
  const importantCount = items.filter((item) => item.important).length;
  const days = Math.max(1, Math.round(hours / 24));
  const visible = expanded ? items : items.slice(0, TOP_COUNT);
  const hiddenCount = Math.max(0, items.length - TOP_COUNT);

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3.5">
      <SectionTitle
        title="Berita terbaru"
        hint={`${symbol} · ${items.length} item · ${days} hari terakhir (waktu ET)`}
        action={
          <Button
            size="sm"
            variant="soft"
            className="h-9 px-3"
            onClick={refresh}
            disabled={pending}
            aria-label="Muat ulang berita terbaru dari Yahoo Finance dan SEC"
          >
            <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden="true" />
            {pending ? "Memuat…" : "Muat ulang"}
          </Button>
        }
      />

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Ketuk <span className="font-semibold text-foreground">Muat ulang</span> untuk mengambil berita
        terbaru. Urutan: paling baru dulu. 8-K = laporan kejadian penting ke SEC.
      </p>

      {importantCount > 0 ? (
        <p className="rounded-2xl bg-warning-soft px-3.5 py-2 text-[12px] font-medium text-warning">
          {importantCount} berita ditandai penting (laba, pergantian manajemen, laporan ulang, dsb).
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={<Newspaper className="size-5" aria-hidden="true" />}
          title="Belum ada berita terbaru"
          description={`Yahoo Finance & SEC EDGAR tidak mengembalikan berita dalam ${days} hari terakhir. Coba Muat ulang nanti.`}
        />
      ) : (
        <>
          <ul className="space-y-2.5">
            {visible.map((item) => (
              <NewsRow key={item.id} item={item} />
            ))}
          </ul>
          {hiddenCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              <ChevronDown
                className={cn("size-4 transition-transform", expanded && "rotate-180")}
                aria-hidden="true"
              />
              {expanded ? "Tampilkan lebih sedikit" : `Lihat semua (${items.length})`}
            </Button>
          ) : null}
        </>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Berita dari Yahoo Finance (gratis, bisa tertunda) dan laporan dari SEC EDGAR. Tautan membuka
        tab baru. Tidak ada berita yang dikarang.
      </p>
    </div>
  );
}
