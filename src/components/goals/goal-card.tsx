"use client";

import {
  CalendarDays,
  CheckCircle2,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/components/app/app-context";
import { MONTHS_SHORT, daysBetween, splitISODate, todayISO } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import type { GoalDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProgressRing } from "./progress-ring";

function deadlineMeta(deadline: string | null): {
  label: string;
  daysLeft: number | null;
  overdue: boolean;
} {
  if (!deadline) return { label: "Tanpa tenggat", daysLeft: null, overdue: false };

  const { year, month, day } = splitISODate(deadline);
  const formatted = `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
  const daysLeft = daysBetween(todayISO(), deadline);

  if (daysLeft < 0) {
    return { label: `Tenggat lewat · ${formatted}`, daysLeft, overdue: true };
  }
  return { label: `s.d. ${formatted}`, daysLeft, overdue: false };
}

export function GoalCard({
  goal,
  index = 0,
  onEdit,
  onAddSavings,
  onDelete,
}: {
  goal: GoalDTO;
  index?: number;
  onEdit: () => void;
  onAddSavings: () => void;
  onDelete: () => void;
}) {
  const { currency } = useApp();
  const deadline = deadlineMeta(goal.deadline);
  const complete = goal.progress >= 100;
  const urgent = deadline.daysLeft !== null && deadline.daysLeft >= 0 && deadline.daysLeft <= 30;

  return (
    <Card
      className="animate-rise p-5"
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <PiggyBank className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-snug">{goal.name}</p>
            <p
              className={cn(
                "mt-0.5 flex items-center gap-1 text-[11.5px] font-medium",
                deadline.overdue
                  ? "text-danger"
                  : urgent
                    ? "text-warning"
                    : "text-muted-foreground",
              )}
            >
              <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{deadline.label}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="iconSm"
            className="size-10"
            onClick={onEdit}
            aria-label={`Ubah target ${goal.name}`}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            className="size-10 text-muted-foreground hover:text-danger"
            onClick={onDelete}
            aria-label={`Hapus target ${goal.name}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <ProgressRing value={goal.progress} size={70} strokeWidth={7} />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Terkumpul
          </p>
          <p className="money mt-0.5 text-[22px] font-bold leading-tight tracking-tight">
            {formatMoney(goal.savedAmount, currency)}
          </p>
          <p className="money text-[11.5px] text-muted-foreground">
            dari {formatMoney(goal.targetAmount, currency)}
          </p>
        </div>
      </div>

      <Progress
        value={goal.progress}
        tone={complete ? "success" : "primary"}
        className="mt-3.5"
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          {complete ? (
            <Badge tone="success">
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Target tercapai
            </Badge>
          ) : (
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              Sisa{" "}
              <span className="money font-semibold text-foreground">
                {formatMoney(goal.remaining, currency)}
              </span>{" "}
              lagi
              {urgent ? (
                <span className="text-warning">
                  {" "}
                  · {deadline.daysLeft === 0 ? "hari terakhir" : `${deadline.daysLeft} hari lagi`}
                </span>
              ) : null}
            </p>
          )}
        </div>
        <Button
          variant="soft"
          size="sm"
          className="h-10 shrink-0 px-3.5"
          onClick={onAddSavings}
        >
          <Plus className="size-4" aria-hidden="true" />
          Tambah tabungan
        </Button>
      </div>
    </Card>
  );
}
