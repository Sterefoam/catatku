"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, ReceiptText, Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataHint, SectionTitle, StatTile } from "@/components/trading/ui";
import { apiErrorMessage, apiPatch } from "@/lib/client-api";
import {
  fmtCentsSigned,
  fmtEtDateTime,
  fmtPrice,
  fmtQty,
} from "@/lib/trading/format";
import type { MarketStatus, OrderDTO, TradingSettings } from "@/lib/trading/types";
import type { TradingStats } from "@/lib/trading/data";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import { OrderActionDialog } from "./order-action-dialog";
import { EXIT_REASON_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "./desk-shared";

function OrderFacts({
  order,
  hint,
}: {
  order: OrderDTO;
  hint: string;
}) {
  const exitPrice = order.closedPrice ?? order.filledPrice;
  const exitTone = (order.pnl ?? 0) >= 0 ? "text-success" : "text-danger";
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[15px] font-bold">{order.symbol}</h3>
            <Badge tone={ORDER_STATUS_TONES[order.status]}>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
            {fmtQty(order.qty)} lembar · rugi maks {fmtPrice(order.riskAmount)} · {hint}
          </p>
        </div>
        {order.pnl !== null ? (
          <span className={cn("money shrink-0 text-[14px] font-bold", exitTone)}>
            {fmtCentsSigned(order.pnl)}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Harga masuk" value={fmtPrice(order.entry)} />
        <StatTile label="Batas rugi" value={fmtPrice(order.stop)} tone="danger" />
        <StatTile label="Target untung" value={fmtPrice(order.target)} tone="success" />
        <StatTile
          label={order.status === "closed" ? "Harga tutup" : "Harga isi"}
          value={exitPrice ? fmtPrice(exitPrice) : "—"}
          hint={
            order.exitReason
              ? EXIT_REASON_LABELS[order.exitReason]
              : order.filledAt
                ? `diisi ${fmtEtDateTime(order.filledAt)}`
                : "belum diisi"
          }
        />
      </div>
    </>
  );
}

/**
 * Papan order kertas: ringkasan risiko hari ini, order menunggu, posisi
 * terbuka, dan jurnal order selesai.
 */
export function OrdersBoard({
  orders,
  stats,
  settings,
  market,
}: {
  orders: OrderDTO[];
  stats: TradingStats;
  settings: TradingSettings;
  market: MarketStatus;
}) {
  const router = useRouter();
  const [actionState, setActionState] = React.useState<{
    order: OrderDTO;
    action: "fill" | "close";
  } | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<OrderDTO | null>(null);
  const [busy, setBusy] = React.useState(false);

  const pending = orders.filter((order) => order.status === "pending");
  const open = orders.filter((order) => order.status === "filled");
  const journal = orders.filter(
    (order) => order.status === "closed" || order.status === "cancelled",
  );
  const wins = journal.filter((order) => (order.pnl ?? 0) > 0).length;
  const losses = journal.filter((order) => (order.pnl ?? 0) < 0).length;
  const riskPct =
    settings.dailyLossLimit > 0
      ? Math.min(100, Math.round((stats.riskToday / settings.dailyLossLimit) * 100))
      : 0;

  async function cancelOrder() {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await apiPatch(`/api/trading/orders/${cancelTarget.id}`, { action: "cancel" });
      toast.success(`Order ${cancelTarget.symbol} dibatalkan.`);
      setCancelTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3" aria-label="Ringkasan hari ini">
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile
            label="Posisi terbuka"
            value={String(stats.openPositions)}
            hint="sedang berjalan"
          />
          <StatTile
            label="Order menunggu"
            value={String(stats.pendingOrders)}
            hint="belum diisi"
          />
          <StatTile
            label="Hasil hari ini"
            value={fmtCentsSigned(stats.realizedPnlToday)}
            tone={
              stats.realizedPnlToday > 0
                ? "success"
                : stats.realizedPnlToday < 0
                  ? "danger"
                  : "default"
            }
            hint="latihan (uang kertas)"
          />
        </div>
        <div className="space-y-1 rounded-2xl bg-surface/40 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <p>
            Kalau semua posisi kena batas rugi:{" "}
            <span
              className={cn(
                "font-semibold",
                stats.openRisk > 0 ? "text-warning" : "text-foreground",
              )}
            >
              {fmtPrice(stats.openRisk)}
            </span>
            {stats.openRisk > 0
              ? ` dari ${stats.openPositions} posisi terbuka`
              : " (belum ada posisi terbuka)"}
            .
          </p>
          <p>
            Risiko hari ini {fmtPrice(stats.riskToday)} dari batas{" "}
            {fmtPrice(settings.dailyLossLimit)}
            {settings.dailyLossLimit > 0 ? ` (${riskPct}%)` : ""} · trade hari ini{" "}
            {stats.tradesToday}/{settings.maxTradesPerDay} · modal latihan{" "}
            {fmtPrice(stats.paperEquity)} · {market.label} · jam keluar{" "}
            {settings.flatBy} ET.
          </p>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="order-menunggu">
        <SectionTitle
          title="Menunggu harga masuk"
          hint="Order latihan yang belum diisi. Isi saat harga menyentuh harga masuk."
          action={
            <Link href="/trading/rencana">
              <Button size="sm" variant="outline">
                Buat rencana
              </Button>
            </Link>
          }
        />
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
            Tidak ada order menunggu. Buat order latihan dari halaman Rencana setelah rencana
            tersimpan.
          </p>
        ) : (
          <div className="space-y-2.5">
            {pending.map((order) => (
              <Card key={order.id} className="space-y-3 p-4">
                <OrderFacts order={order} hint={`dibuat ${fmtEtDateTime(order.createdAt)}`} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => setActionState({ order, action: "fill" })}
                    disabled={busy}
                  >
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Isi order
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCancelTarget(order)}
                    disabled={busy}
                  >
                    <Ban className="size-3.5" aria-hidden="true" />
                    Batalkan
                  </Button>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Isi order = catat beli di harga terakhir. Batalkan = tidak jadi masuk.
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="posisi-terbuka">
        <SectionTitle
          title="Posisi terbuka"
          hint="Posisi latihan yang sedang berjalan. Tutup saat batas rugi/target kena atau jam keluar."
        />
        {open.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
            Belum ada posisi terbuka. Isi order yang menunggu saat harga masuk tersentuh.
          </p>
        ) : (
          <div className="space-y-2.5">
            {open.map((order) => (
              <Card key={order.id} className="space-y-3 p-4">
                <OrderFacts
                  order={order}
                  hint={`terbuka sejak ${fmtEtDateTime(order.filledAt ?? order.createdAt)}`}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setActionState({ order, action: "close" })}
                    disabled={busy}
                  >
                    <ReceiptText className="size-3.5" aria-hidden="true" />
                    Tutup posisi
                  </Button>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Tutup posisi = catat keluar di harga terakhir. Alasan keluar diisi otomatis:
                  target, batas rugi, atau manual.
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="jurnal-order">
        <SectionTitle
          title="Jurnal (selesai)"
          hint={
            journal.length
              ? `${journal.length} order selesai · ${wins} untung · ${losses} rugi`
              : "Belum ada order selesai."
          }
        />
        {journal.length === 0 ? (
          <EmptyState
            compact
            icon={<ClipboardList className="size-5" aria-hidden="true" />}
            title="Jurnal masih kosong"
            description="Setelah posisi ditutup, hasil latihan tercatat di sini supaya bisa dievaluasi."
          />
        ) : (
          <Card className="divide-y divide-border/70 overflow-hidden">
            {journal.map((order) => (
              <div key={order.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">
                    {order.symbol}
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      · {fmtQty(order.qty)} lembar
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {ORDER_STATUS_LABELS[order.status]}
                    {order.exitReason ? ` · ${EXIT_REASON_LABELS[order.exitReason]}` : ""}
                    {order.closedAt ? ` · ${fmtEtDateTime(order.closedAt)}` : ""}
                  </p>
                </div>
                {order.pnl !== null ? (
                  <span
                    className={cn(
                      "money shrink-0 text-[13px] font-bold",
                      (order.pnl ?? 0) >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {fmtCentsSigned(order.pnl)}
                  </span>
                ) : (
                  <Badge tone="neutral">tanpa hasil</Badge>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>

      <DataHint>
        Order di halaman ini hanya catatan latihan (uang kertas) di Catatku — tidak dikirim ke
        broker mana pun. Harga acuan dari Yahoo Finance (gratis, bisa tertunda), jadi harga
        isi/tutup bisa berbeda dari harga sebenarnya.
      </DataHint>

      {actionState ? (
        <OrderActionDialog
          order={actionState.order}
          action={actionState.action}
          onClose={() => setActionState(null)}
        />
      ) : null}

      {cancelTarget ? (
        <ConfirmDialog
          title={`Batalkan order ${cancelTarget.symbol}?`}
          description="Order yang masih menunggu akan dibatalkan dan tidak bisa diisi lagi."
          confirmLabel="Ya, batalkan order"
          busy={busy}
          onConfirm={cancelOrder}
          onClose={() => setCancelTarget(null)}
        />
      ) : null}
    </div>
  );
}
