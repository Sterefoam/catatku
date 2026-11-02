"use client";

import Link from "next/link";
import { Check, Loader2, PenLine, Plus, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PriceChange, SetupPill } from "@/components/trading/ui";
import { fmtPrice, fmtVolume } from "@/lib/trading/format";
import type { ScanHit } from "@/lib/trading/types";
import { cn } from "@/lib/utils";

export function ScanHitCard({
  hit,
  added,
  saving,
  onAdd,
}: {
  hit: ScanHit;
  added: boolean;
  saving: boolean;
  onAdd: (symbol: string) => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15.5px] font-bold tracking-tight">{hit.symbol}</span>
            <SetupPill setup={hit.setup} />
          </div>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{hit.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="money text-[16px] font-bold leading-tight">{fmtPrice(hit.price)}</p>
          <PriceChange changePct={hit.changePct} className="justify-end" />
        </div>
      </div>

      <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
        <span className="font-semibold text-foreground">Kenapa cocok: </span>
        {hit.setup.detail}
      </p>

      <dl className="mt-2.5 grid grid-cols-2 gap-2 text-[11.5px]">
        <div>
          <dt className="text-muted-foreground">Volume hari ini</dt>
          <dd className="money font-semibold">{fmtVolume(hit.volume)} lembar</dd>
        </div>
        {hit.when ? (
          <div>
            <dt className="text-muted-foreground">Waktu tembus</dt>
            <dd className="money font-semibold">pukul {hit.when} ET</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        <Link
          href={`/trading/inspeksi/${hit.symbol}`}
          aria-label={`Periksa ${hit.symbol}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-10 px-3")}
        >
          <Search className="size-4" aria-hidden="true" />
          Periksa
        </Link>
        <Link
          href={`/trading/rencana?symbol=${hit.symbol}`}
          aria-label={`Buat rencana untuk ${hit.symbol}`}
          className={cn(buttonVariants({ size: "sm" }), "h-10 px-3")}
        >
          <PenLine className="size-4" aria-hidden="true" />
          Buat rencana
        </Link>
        <Button
          variant="soft"
          size="sm"
          className="h-10 px-3"
          onClick={() => onAdd(hit.symbol)}
          disabled={added || saving}
          aria-label={
            added ? `${hit.symbol} sudah di daftar pantau` : `Tambah ${hit.symbol} ke daftar pantau`
          }
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : added ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {added ? "Sudah di daftar" : saving ? "Menyimpan…" : "Daftar pantau"}
        </Button>
      </div>
    </Card>
  );
}
