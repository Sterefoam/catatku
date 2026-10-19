"use client";

import * as React from "react";
import { BellRing, Check, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DayPicker } from "./day-picker";
import {
  describeDays,
  describeSchedule,
  formatReminderTime,
  type ReminderDay,
} from "./schedule";

/**
 * Kartu "Pengingat catat harian": sakelar aktif, jam, hari, dan tombol simpan.
 */
export function ReminderScheduleCard({
  time,
  days,
  isActive,
  dirty,
  saving,
  onTimeChange,
  onDaysChange,
  onToggleActive,
  onSave,
  onReset,
}: {
  time: string;
  days: ReminderDay[];
  isActive: boolean;
  dirty: boolean;
  saving: boolean;
  onTimeChange: (time: string) => void;
  onDaysChange: (days: ReminderDay[]) => void;
  onToggleActive: (active: boolean) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const [blockedHint, setBlockedHint] = React.useState(false);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
              isActive ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <BellRing className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-semibold">Pengingat catat harian</p>
              <Badge tone={isActive ? "success" : "neutral"}>{isActive ? "Aktif" : "Nonaktif"}</Badge>
            </div>
            <p
              className={cn(
                "mt-0.5 text-[12px] leading-snug",
                isActive ? "text-muted-foreground" : "font-medium text-muted-foreground",
              )}
              aria-live="polite"
            >
              {describeSchedule({ time, days, isActive })}
            </p>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={onToggleActive}
            disabled={saving}
            aria-label="Aktifkan pengingat catat harian"
            className="mt-0.5"
          />
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {!isActive ? (
          <p className="rounded-2xl bg-muted/70 px-3.5 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            Pengingat sedang dimatikan. Nyalakan sakelar di atas supaya kamu diingatkan mencatat
            sesuai jadwal di bawah.
          </p>
        ) : null}

        <Field
          label="Jam pengingat"
          htmlFor="reminder-time"
          hint="Waktu mengikuti zona Asia/Jakarta."
        >
          <div className="relative w-full sm:w-44">
            <Clock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reminder-time"
              type="time"
              step={60}
              value={time}
              onChange={(event) => {
                const value = event.target.value;
                if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) onTimeChange(value);
              }}
              disabled={saving}
              aria-label="Jam pengingat"
              className="money pl-10"
            />
          </div>
        </Field>

        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-muted-foreground">Hari aktif</p>
          <DayPicker
            value={days}
            onChange={onDaysChange}
            disabled={saving}
            onBlockedToggle={() => setBlockedHint(true)}
          />
          {blockedHint ? (
            <p className="text-[11.5px] font-medium text-warning" role="status">
              Minimal satu hari harus aktif.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11.5px] text-muted-foreground" aria-live="polite">
            {dirty
              ? "Ada perubahan jadwal yang belum disimpan."
              : isActive
                ? `Tersimpan: ${describeDays(days)} pukul ${formatReminderTime(time)}.`
                : "Jadwal nonaktif — pengaturan tetap tersimpan."}
          </p>
          <div className="flex gap-2 sm:shrink-0">
            {dirty ? (
              <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
                Batalkan
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={dirty ? "primary" : "soft"}
              onClick={onSave}
              disabled={!dirty || saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Simpan jadwal
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
