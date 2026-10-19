"use client";

import * as React from "react";
import { Plus } from "lucide-react";
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
import { apiErrorMessage, apiPatch } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import type { GoalDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProgressRing } from "./progress-ring";

export function AddSavingsDialog({
  goal,
  onClose,
}: {
  goal: GoalDTO;
  onClose: () => void;
}) {
  const { currency, refresh } = useApp();
  const [amount, setAmount] = React.useState<number | null>(null);
  const [amountKey, setAmountKey] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const projected = goal.savedAmount + (amount ?? 0);
  const projectedProgress =
    goal.targetAmount > 0
      ? Math.min(100, Math.round((projected / goal.targetAmount) * 100))
      : 0;
  const willComplete = goal.targetAmount > 0 && projected >= goal.targetAmount;
  const projectedRemaining = Math.max(0, goal.targetAmount - projected);

  const quickAmounts =
    remaining > 0
      ? [
          { label: "25% sisa", value: Math.max(1, Math.ceil(remaining / 4)) },
          { label: "50% sisa", value: Math.max(1, Math.ceil(remaining / 2)) },
          { label: "Lunasi sisa", value: remaining },
        ]
      : [];

  function applyQuickAmount(value: number) {
    setAmount(value);
    setAmountKey((current) => current + 1);
    setError(null);
  }

  async function handleSubmit() {
    if (!amount || amount <= 0) {
      setError("Nominal tabungan belum diisi. Isi dulu nominalnya ya.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const nextSaved = goal.savedAmount + amount;
      await apiPatch(`/api/goals/${goal.id}`, { savedAmount: nextSaved });
      const done = goal.targetAmount > 0 && nextSaved >= goal.targetAmount;
      toast.success(
        done
          ? `Selamat! Target “${goal.name}” tercapai.`
          : `${formatMoney(amount, currency)} berhasil ditabung ke “${goal.name}”.`,
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
          <DialogTitle>Tambah tabungan</DialogTitle>
          <DialogDescription>
            Catat nominal yang baru kamu sisihkan untuk “{goal.name}”.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="rounded-3xl border border-border/70 bg-surface/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Terkumpul saat ini
                </p>
                <p className="money mt-1 text-[21px] font-bold leading-tight tracking-tight">
                  {formatMoney(goal.savedAmount, currency)}
                </p>
                <p className="money text-[11.5px] text-muted-foreground">
                  dari {formatMoney(goal.targetAmount, currency)}
                </p>
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                  Sisa{" "}
                  <span className="money font-semibold text-foreground">
                    {formatMoney(remaining, currency)}
                  </span>
                </p>
              </div>
              <ProgressRing value={goal.progress} size={64} strokeWidth={6} />
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Nominal yang ditabung
            </p>
            <div
              className={cn(
                "rounded-2xl border border-border/70 bg-surface/60 px-3 py-2 transition-colors",
                error && "border-danger/40 bg-danger-soft/40",
              )}
            >
              <AmountInput
                key={amountKey}
                currency={currency}
                initialMinor={amount}
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
            ) : null}
          </div>

          {quickAmounts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => applyQuickAmount(chip.value)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[12px] font-semibold transition-colors hover:bg-muted"
                >
                  <Plus className="size-3.5 text-primary" aria-hidden="true" />
                  {chip.label}
                  <span className="money font-medium text-muted-foreground">
                    {formatMoney(chip.value, currency)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {amount && amount > 0 ? (
            <p
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed",
                willComplete
                  ? "bg-success-soft text-success"
                  : "bg-primary-soft/70 text-primary",
              )}
            >
              Setelah ditambah: terkumpul{" "}
              <span className="money font-semibold">{formatMoney(projected, currency)}</span>{" "}
              ({projectedProgress}%)
              {willComplete
                ? " — target tercapai!"
                : `, sisa ${formatMoney(projectedRemaining, currency)}.`}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button size="lg" className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan tabungan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
