"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ClipboardList, Loader2, ReceiptText, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionTitle, StatTile } from "@/components/trading/ui";
import { apiDelete, apiErrorMessage, apiPatch, apiPost } from "@/lib/client-api";
import { fmtDate, fmtPrice, fmtQty, fmtR } from "@/lib/trading/format";
import type { TradePlanDTO } from "@/lib/trading/types";
import { ConfirmDialog } from "./confirm-dialog";
import {
  PLAN_STATUS_LABELS,
  SETUP_TYPE_LABELS,
  humaniseStopRuleLabel,
  humaniseTargetRuleLabel,
  rMultipleText,
} from "./desk-shared";

/**
 * Daftar rencana aktif dengan aksi: buat order latihan, batalkan, hapus.
 * Data awal berasal dari server component; setiap mutasi memicu refresh.
 */
export function PlanList({ plans }: { plans: TradePlanDTO[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<TradePlanDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<TradePlanDTO | null>(null);

  async function createOrder(plan: TradePlanDTO) {
    setBusy(`order:${plan.id}`);
    try {
      await apiPost("/api/trading/orders", { planId: plan.id });
      toast.success(
        `Order latihan ${plan.symbol} dibuat. Buka Posisi untuk mengisi order saat harga masuk tersentuh.`,
      );
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setBusy(`cancel:${cancelTarget.id}`);
    try {
      await apiPatch(`/api/trading/plans/${cancelTarget.id}`, { status: "cancelled" });
      toast.success("Rencana dibatalkan.");
      setCancelTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(`delete:${deleteTarget.id}`);
    try {
      await apiDelete(`/api/trading/plans/${deleteTarget.id}`);
      toast.success("Rencana dihapus.");
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="rencana-aktif-heading">
      <SectionTitle
        title="Rencana aktif"
        hint={
          plans.length
            ? `${plans.length} rencana siap dipantau. Order latihan memakai jumlah lembar dari rencana.`
            : "Belum ada rencana aktif."
        }
        action={
          <Link href={plans[0] ? `/trading/alert?symbol=${plans[0].symbol}` : "/trading/alert"}>
            <Button size="sm" variant="outline">
              <Bell className="size-3.5" aria-hidden="true" />
              Buat pengingat
            </Button>
          </Link>
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" aria-hidden="true" />}
          title="Belum ada rencana aktif"
          description="Hitung rencana di atas lalu simpan. Setelah tersimpan, buat order latihan dan pantau lewat halaman Posisi & Pengingat."
          action={
            <Link href="/trading/posisi">
              <Button variant="soft">Buka halaman Posisi</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {plans.map((plan) => (
            <Card key={plan.id} className="space-y-3 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-[16px] font-bold">{plan.symbol}</h3>
                    <Badge tone={plan.status === "triggered" ? "success" : "primary"}>
                      {PLAN_STATUS_LABELS[plan.status]}
                    </Badge>
                    <Badge tone="neutral">{SETUP_TYPE_LABELS[plan.setupType]}</Badge>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                    batas rugi {humaniseStopRuleLabel(plan.stopRuleLabel)} · target{" "}
                    {humaniseTargetRuleLabel(plan.targetRuleLabel)} · jam keluar {plan.flatBy} ET ·
                    dibuat {fmtDate(plan.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Imbalan : risiko
                  </p>
                  <p className="money text-[14px] font-bold">{fmtR(plan.rewardRisk)}</p>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    {rMultipleText(plan.rewardRisk)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Harga masuk" value={fmtPrice(plan.entry)} />
                <StatTile label="Batas rugi" value={fmtPrice(plan.stop)} tone="danger" />
                <StatTile label="Target untung" value={fmtPrice(plan.target)} tone="success" />
                <StatTile
                  label="Jumlah lembar"
                  value={`${fmtQty(plan.size.qty)} lbr`}
                  hint={`rugi kalau kena batas: ${fmtPrice(plan.size.riskAmount)}`}
                />
              </div>

              {plan.note ? (
                <p className="rounded-2xl bg-surface/70 px-3.5 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
                  {plan.note}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => createOrder(plan)}
                  disabled={busy !== null}
                >
                  {busy === `order:${plan.id}` ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ReceiptText className="size-3.5" aria-hidden="true" />
                  )}
                  Buat order latihan
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCancelTarget(plan)}
                  disabled={busy !== null}
                >
                  <XCircle className="size-3.5" aria-hidden="true" />
                  Batalkan
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:text-danger"
                  onClick={() => setDeleteTarget(plan)}
                  disabled={busy !== null}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Hapus
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {cancelTarget ? (
        <ConfirmDialog
          title={`Batalkan rencana ${cancelTarget.symbol}?`}
          description="Rencana tidak akan dipakai lagi untuk order baru. Order latihan yang sudah dibuat tetap ada di halaman Posisi."
          confirmLabel="Ya, batalkan"
          busy={busy === `cancel:${cancelTarget.id}`}
          onConfirm={confirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title={`Hapus rencana ${deleteTarget.symbol}?`}
          description="Rencana dihapus permanen. Order latihan yang terlanjur dibuat tidak ikut terhapus."
          confirmLabel="Hapus rencana"
          busy={busy === `delete:${deleteTarget.id}`}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
    </section>
  );
}
