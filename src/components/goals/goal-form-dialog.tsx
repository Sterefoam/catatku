"use client";

import * as React from "react";
import { CalendarDays, Target } from "lucide-react";
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
import { Field, Input } from "@/components/ui/input";
import { useApp } from "@/components/app/app-context";
import { ApiClientError, apiErrorMessage, apiPatch, apiPost } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import type { GoalDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MoneyField } from "./money-field";

export interface GoalPreset {
  name: string;
  targetAmount: number | null;
}

export function GoalFormDialog({
  goal,
  preset,
  onClose,
}: {
  goal: GoalDTO | null;
  preset?: GoalPreset;
  onClose: () => void;
}) {
  const { currency, refresh } = useApp();
  const editing = Boolean(goal);

  const [name, setName] = React.useState(goal?.name ?? preset?.name ?? "");
  const [targetAmount, setTargetAmount] = React.useState<number | null>(
    goal?.targetAmount ?? preset?.targetAmount ?? null,
  );
  const [savedAmount, setSavedAmount] = React.useState<number | null>(
    goal?.savedAmount ?? null,
  );
  const [deadline, setDeadline] = React.useState(goal?.deadline ?? "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const targetValue = targetAmount ?? 0;
  const savedValue = savedAmount ?? 0;
  const canPreview = targetValue > 0 && savedValue > 0;
  const previewProgress = canPreview
    ? Math.min(100, Math.round((savedValue / targetValue) * 100))
    : 0;
  const previewRemaining = Math.max(0, targetValue - savedValue);

  async function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    const trimmedName = name.trim();

    if (!trimmedName) nextErrors.name = "Nama target wajib diisi.";
    else if (trimmedName.length > 60) nextErrors.name = "Nama target maksimal 60 karakter.";
    if (targetValue <= 0) nextErrors.targetAmount = "Nominal target harus lebih dari nol.";
    if (savedAmount !== null && savedAmount < 0) {
      nextErrors.savedAmount = "Jumlah terkumpul tidak boleh negatif.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const body = {
        name: trimmedName,
        targetAmount: targetValue,
        savedAmount: savedValue,
        deadline: deadline || null,
      };

      if (goal) {
        await apiPatch(`/api/goals/${goal.id}`, body);
        toast.success("Perubahan target tersimpan.");
      } else {
        await apiPost("/api/goals", body);
        toast.success("Target tabungan baru dibuat.");
      }
      refresh();
      onClose();
    } catch (error) {
      const message = apiErrorMessage(error);
      const details = error instanceof ApiClientError ? error.details : undefined;
      setErrors({ ...(details ?? {}), form: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah target" : "Target baru"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Perbarui nama, nominal, atau progres target ini. Perubahan langsung terlihat di daftar."
              : "Tentukan tujuan tabunganmu. Bisa diubah kapan saja setelah dibuat."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field
            label="Nama target"
            htmlFor="goal-name"
            error={errors.name}
            hint="Contoh: Dana darurat, Liburan ke Bali, Laptop baru."
          >
            <Input
              id="goal-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (errors.name) setErrors((current) => ({ ...current, name: "" }));
              }}
              maxLength={60}
              placeholder="mis. Dana darurat"
              autoComplete="off"
              autoFocus
            />
          </Field>

          <Field label="Nominal target" htmlFor="goal-target-amount" error={errors.targetAmount}>
            <div
              className={cn(
                "rounded-2xl border border-border/70 bg-surface/60 px-3 py-2 transition-colors",
                errors.targetAmount && "border-danger/40 bg-danger-soft/40",
              )}
            >
              <AmountInput
                id="goal-target-amount"
                currency={currency}
                initialMinor={targetAmount}
                onChange={(value) => {
                  setTargetAmount(value);
                  if (value && value > 0) {
                    setErrors((current) => ({ ...current, targetAmount: "" }));
                  }
                }}
                invalid={Boolean(errors.targetAmount)}
                onEnter={handleSubmit}
              />
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Sudah terkumpul (opsional)"
              htmlFor="goal-saved-amount"
              error={errors.savedAmount}
              hint="Boleh dikosongkan bila mulai dari nol."
            >
              <MoneyField
                id="goal-saved-amount"
                currency={currency}
                initialMinor={savedAmount}
                onChange={(value) => {
                  setSavedAmount(value);
                  if (value === null || value >= 0) {
                    setErrors((current) => ({ ...current, savedAmount: "" }));
                  }
                }}
                invalid={Boolean(errors.savedAmount)}
              />
            </Field>

            <Field
              label="Tenggat (opsional)"
              htmlFor="goal-deadline"
              error={errors.deadline}
              hint="Kapan target ini ingin dicapai?"
            >
              <div className="relative">
                <CalendarDays
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="goal-deadline"
                  type="date"
                  value={deadline}
                  onChange={(event) => {
                    setDeadline(event.target.value);
                    if (errors.deadline) {
                      setErrors((current) => ({ ...current, deadline: "" }));
                    }
                  }}
                  className="pl-10"
                />
              </div>
            </Field>
          </div>

          {canPreview ? (
            <div className="flex items-start gap-2 rounded-2xl bg-surface/70 px-3.5 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
              <Target className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Progres saat ini{" "}
                <span className="font-semibold text-foreground">{previewProgress}%</span> —
                terkumpul {formatMoney(savedValue, currency)} dari{" "}
                {formatMoney(targetValue, currency)}, sisa{" "}
                {formatMoney(previewRemaining, currency)}.
              </span>
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter>
          {errors.form ? (
            <p className="mb-2 text-[12px] font-medium text-danger">{errors.form}</p>
          ) : null}
          <Button size="lg" className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? "Menyimpan..." : editing ? "Simpan perubahan" : "Buat target"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
