"use client";

import * as React from "react";
import { toast } from "sonner";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/components/app/app-context";
import { apiErrorMessage, apiPut } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import type { BudgetUsageDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BudgetFormDialog({
  usage,
  onClose,
}: {
  usage: BudgetUsageDTO;
  onClose: () => void;
}) {
  const { currency, refresh } = useApp();
  const [amount, setAmount] = React.useState<number | null>(
    usage.budget?.limitAmount ?? null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const editing = Boolean(usage.budget);

  async function handleSubmit() {
    if (!amount || amount <= 0) {
      setError("Batas belum diisi. Isi nominal batas dulu ya.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiPut("/api/budgets", {
        limitAmount: amount,
        period: usage.period,
      });
      toast.success(
        editing ? "Batas belanja diperbarui." : "Batas belanja bulan ini tersimpan.",
      );
      refresh();
      onClose();
    } catch (submitError) {
      setError(apiErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah batas belanja" : "Atur batas belanja"}</DialogTitle>
          <DialogDescription>
            Batas ini mengatur semua pengeluaran bulan {usage.periodLabel}. Bisa diubah kapan
            saja.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface/70 px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Pengeluaran {usage.periodLabel}
              </p>
              <p className="money mt-0.5 text-[16px] font-bold">
                {formatMoney(usage.spent, currency)}
              </p>
            </div>
            {usage.budget ? (
              <div className="shrink-0 text-right">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Batas sekarang
                </p>
                <p className="money mt-0.5 text-[16px] font-bold text-primary">
                  {formatMoney(usage.budget.limitAmount, currency)}
                </p>
              </div>
            ) : null}
          </div>

          <div>
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Batas belanja bulanan
            </p>
            <div
              className={cn(
                "rounded-2xl border border-border/70 bg-surface/60 px-3 py-2 transition-colors",
                error && "border-danger/40 bg-danger-soft/40",
              )}
            >
              <AmountInput
                currency={currency}
                initialMinor={usage.budget?.limitAmount ?? null}
                onChange={(value) => {
                  setAmount(value);
                  if (value && value > 0) setError(null);
                }}
                invalid={Boolean(error)}
                autoFocus
                onEnter={handleSubmit}
              />
            </div>
            {error ? (
              <p className="mt-1.5 text-[12px] font-medium text-danger">{error}</p>
            ) : (
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                Pilih nominal yang realistis. Kamu bisa mengubahnya kapan saja.
              </p>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button size="lg" className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? "Menyimpan..." : editing ? "Simpan perubahan" : "Simpan batas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
