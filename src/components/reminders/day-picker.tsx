"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ALL_DAYS, WORK_DAYS, type ReminderDay } from "./schedule";

/**
 * Pemilih hari pengingat: chip Sen–Min (multi-select) plus pintasan
 * "Setiap hari" dan "Hari kerja". Minimal satu hari tetap aktif.
 */
export function DayPicker({
  value,
  onChange,
  disabled = false,
  onBlockedToggle,
}: {
  value: ReminderDay[];
  onChange: (days: ReminderDay[]) => void;
  disabled?: boolean;
  onBlockedToggle?: () => void;
}) {
  const toggle = (day: ReminderDay) => {
    const selected = value.includes(day);
    if (selected && value.length === 1) {
      onBlockedToggle?.();
      return;
    }
    const next = selected
      ? value.filter((item) => item !== day)
      : ALL_DAYS.filter((item) => item === day || value.includes(item));
    onChange(next);
  };

  const allSelected = value.length === ALL_DAYS.length;
  const workSelected =
    value.length === WORK_DAYS.length && WORK_DAYS.every((day) => value.includes(day));

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Hari pengingat"
      >
        {WEEKDAYS.map(({ key, label, full }) => {
          const selected = value.includes(key);
          const isLastSelected = selected && value.length === 1;
          return (
            <button
              key={key}
              type="button"
              aria-label={full}
              aria-pressed={selected}
              aria-disabled={disabled || isLastSelected}
              title={isLastSelected ? "Minimal satu hari aktif" : full}
              disabled={disabled}
              onClick={() => toggle(key)}
              className={cn(
                "h-10 min-w-12 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                selected
                  ? "border-primary/40 bg-primary-soft text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                isLastSelected && "opacity-80",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={allSelected ? "soft" : "outline"}
          className={cn("h-10", allSelected && "ring-1 ring-primary/25")}
          aria-pressed={allSelected}
          disabled={disabled}
          onClick={() => onChange([...ALL_DAYS])}
        >
          Setiap hari
        </Button>
        <Button
          type="button"
          size="sm"
          variant={workSelected ? "soft" : "outline"}
          className={cn("h-10", workSelected && "ring-1 ring-primary/25")}
          aria-pressed={workSelected}
          disabled={disabled}
          onClick={() => onChange([...WORK_DAYS])}
        >
          Hari kerja
        </Button>
        <p className="text-[11.5px] text-muted-foreground">Minimal satu hari aktif.</p>
      </div>
    </div>
  );
}
