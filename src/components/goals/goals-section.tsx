"use client";

import * as React from "react";
import { PiggyBank, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useApp } from "@/components/app/app-context";
import { formatMoney } from "@/lib/money";
import type { GoalDTO } from "@/lib/types";
import { AddSavingsDialog } from "./add-savings-dialog";
import { DeleteGoalDialog } from "./delete-goal-dialog";
import { GoalCard } from "./goal-card";
import { GoalFormDialog, type GoalPreset } from "./goal-form-dialog";

interface FormState {
  goal: GoalDTO | null;
  preset?: GoalPreset;
}

export function GoalsSection({
  goals,
  emergencySuggestion,
}: {
  goals: GoalDTO[];
  emergencySuggestion: number | null;
}) {
  const { currency } = useApp();
  const [formState, setFormState] = React.useState<FormState | null>(null);
  const [savingsGoal, setSavingsGoal] = React.useState<GoalDTO | null>(null);
  const [deleteGoal, setDeleteGoal] = React.useState<GoalDTO | null>(null);

  const totalSaved = goals.reduce((total, goal) => total + goal.savedAmount, 0);
  const totalTarget = goals.reduce((total, goal) => total + goal.targetAmount, 0);

  const emptyDescription =
    emergencySuggestion && emergencySuggestion > 0
      ? `Mulai dari yang paling penting: dana darurat 6× pengeluaran bulanan, sekitar ${formatMoney(
          emergencySuggestion,
          currency,
        )}. Bisa juga liburan atau gadget baru.`
      : "Mulai dari yang paling penting: dana darurat 6× pengeluaran bulanan, liburan, atau gadget baru.";

  const suggestions: GoalPreset[] = [
    { name: "Dana darurat", targetAmount: emergencySuggestion },
    { name: "Liburan", targetAmount: null },
    { name: "Gadget baru", targetAmount: null },
  ];

  return (
    <section className="space-y-3.5" aria-labelledby="target-heading">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="target-heading"
            className="text-[17px] font-bold tracking-tight sm:text-lg"
          >
            Target tabungan
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {goals.length > 0
              ? `${goals.length} target · terkumpul ${formatMoney(
                  totalSaved,
                  currency,
                )} dari ${formatMoney(totalTarget, currency)}`
              : "Belum ada target tabungan."}
          </p>
        </div>
        {goals.length > 0 ? (
          <Button
            size="sm"
            className="h-10 shrink-0 px-3.5"
            onClick={() => setFormState({ goal: null })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Tambah
          </Button>
        ) : null}
      </div>

      {goals.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            icon={<PiggyBank className="size-6" aria-hidden="true" />}
            title="Belum ada target tabungan"
            description={emptyDescription}
            action={
              <Button onClick={() => setFormState({ goal: null })}>
                <Plus className="size-4" aria-hidden="true" />
                Buat target pertama
              </Button>
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              Ide cepat:
            </span>
            {suggestions.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => setFormState({ goal: null, preset })}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[12.5px] font-semibold transition-colors hover:bg-muted"
              >
                {preset.name}
                {preset.targetAmount && preset.targetAmount > 0 ? (
                  <span className="money text-[11px] font-medium text-muted-foreground">
                    {formatMoney(preset.targetAmount, currency)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {goals.map((goal, index) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              index={index}
              onEdit={() => setFormState({ goal })}
              onAddSavings={() => setSavingsGoal(goal)}
              onDelete={() => setDeleteGoal(goal)}
            />
          ))}
        </div>
      )}

      {formState ? (
        <GoalFormDialog
          goal={formState.goal}
          preset={formState.preset}
          onClose={() => setFormState(null)}
        />
      ) : null}

      {savingsGoal ? (
        <AddSavingsDialog goal={savingsGoal} onClose={() => setSavingsGoal(null)} />
      ) : null}

      {deleteGoal ? (
        <DeleteGoalDialog goal={deleteGoal} onClose={() => setDeleteGoal(null)} />
      ) : null}
    </section>
  );
}
