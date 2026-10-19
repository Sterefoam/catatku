"use client";

import * as React from "react";
import { Pencil, Target, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/components/app/app-context";
import { apiDelete, apiErrorMessage } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import type { BudgetUsageDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BudgetFormDialog } from "./budget-form-dialog";

const STATUS_META = {
  safe: { label: "Aman", badge: "success", bar: "success", text: "text-success" },
  warning: {
    label: "Mendekati batas",
    badge: "warning",
    bar: "warning",
    text: "text-warning",
  },
  over: { label: "Terlewati", badge: "danger", bar: "danger", text: "text-danger" },
  none: {
    label: "Belum diatur",
    badge: "neutral",
    bar: "primary",
    text: "text-muted-foreground",
  },
} as const;

function DeleteBudgetDialog({
  periodLabel,
  deleting,
  onCancel,
  onConfirm,
}: {
  periodLabel: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus batas belanja?</DialogTitle>
          <DialogDescription>
            Batas belanja bulan {periodLabel} akan dihapus. Pengeluaranmu tetap tercatat
            seperti biasa.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex items-start gap-2.5 rounded-2xl bg-danger-soft/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Kamu bisa memasang batas lagi kapan saja. Total pengeluaran bulan ini tetap
              bisa dipantau di halaman ini.
            </span>
          </div>
        </DialogBody>

        <DialogFooter>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={deleting}>
              Batal
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={onConfirm}
              disabled={deleting}
            >
              {deleting ? "Menghapus..." : "Ya, hapus"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BudgetSection({ usage }: { usage: BudgetUsageDTO }) {
  const { currency, refresh } = useApp();
  const [formOpen, setFormOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const meta = STATUS_META[usage.status];
  const hasBudget = Boolean(usage.budget);
  const limit = usage.budget?.limitAmount ?? 0;
  const over = usage.remaining < 0;

  const hint = !hasBudget
    ? ""
    : usage.remaining < 0
      ? `Batas terlewati ${formatMoney(Math.abs(usage.remaining), currency)}. Coba tahan pengeluaran sampai akhir bulan.`
      : usage.status === "over"
        ? "Batas bulan ini sudah terpakai penuh. Jangan tambah pengeluaran lagi sampai bulan depan."
        : usage.status === "warning"
          ? `Hampir penuh. Sisa ${formatMoney(usage.remaining, currency)} untuk sampai akhir bulan.`
          : `Masih lega. Sisa ${formatMoney(usage.remaining, currency)} bisa dipakai sampai akhir bulan.`;

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiDelete(`/api/budgets?period=${encodeURIComponent(usage.period)}`);
      toast.success("Batas belanja dihapus.");
      refresh();
      setConfirmOpen(false);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  if (!hasBudget) {
    return (
      <section aria-label="Batas belanja bulanan">
        <EmptyState
          icon={<Wallet className="size-6" aria-hidden="true" />}
          title="Belum ada batas belanja"
          description={`Pengeluaran ${usage.periodLabel} baru ${formatMoney(
            usage.spent,
            currency,
          )}. Pasang batas bulanan supaya kamu punya pagar pengeluaran.`}
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Target className="size-4" aria-hidden="true" />
              Atur batas belanja
            </Button>
          }
        />
        {formOpen ? (
          <BudgetFormDialog usage={usage} onClose={() => setFormOpen(false)} />
        ) : null}
      </section>
    );
  }

  return (
    <section aria-label="Batas belanja bulanan">
      <Card className="overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
                <Wallet className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">Batas belanja bulanan</p>
                <p className="text-[11.5px] text-muted-foreground">{usage.periodLabel}</p>
              </div>
            </div>
            <Badge tone={meta.badge} className="shrink-0">
              {meta.label}
            </Badge>
          </div>
        </div>

        <div className="px-5 pb-5 pt-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Terpakai bulan ini
              </p>
              <p className="money mt-1 text-[26px] font-bold leading-none tracking-tight">
                {formatMoney(usage.spent, currency)}
              </p>
            </div>
            <p className="shrink-0 pb-0.5 text-right text-[11.5px] text-muted-foreground">
              dari{" "}
              <span className="money font-semibold text-foreground">
                {formatMoney(limit, currency)}
              </span>
            </p>
          </div>

          <Progress value={usage.percent} tone={meta.bar} className="mt-4 h-2.5" />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px]">
            <span className={cn("font-semibold", meta.text)}>{usage.percent}% terpakai</span>
            <span
              className={cn(
                "money font-semibold",
                over ? "text-danger" : "text-muted-foreground",
              )}
            >
              {over
                ? `Lewat ${formatMoney(Math.abs(usage.remaining), currency)}`
                : `Sisa ${formatMoney(usage.remaining, currency)}`}
            </span>
          </div>

          <p className="mt-3 rounded-2xl bg-surface/70 px-3.5 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            {hint}
          </p>

          <div className="mt-4 flex gap-2">
            <Button
              variant="soft"
              size="sm"
              className="h-10 flex-1"
              onClick={() => setFormOpen(true)}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Ubah batas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 px-3 text-muted-foreground hover:text-danger"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Hapus
            </Button>
          </div>
        </div>
      </Card>

      {formOpen ? (
        <BudgetFormDialog usage={usage} onClose={() => setFormOpen(false)} />
      ) : null}

      {confirmOpen ? (
        <DeleteBudgetDialog
          periodLabel={usage.periodLabel}
          deleting={deleting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleDelete}
        />
      ) : null}
    </section>
  );
}
