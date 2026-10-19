"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiErrorMessage, apiPut } from "@/lib/client-api";
import { nowTime, todayISO, todayWeekday } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import type { BudgetUsageDTO, ReminderDTO } from "@/lib/types";
import { BrowserNotificationsCard } from "./browser-notifications-card";
import { BudgetAlertCard } from "./budget-alert-card";
import { NotificationPreview } from "./notification-preview";
import { ReminderScheduleCard } from "./schedule-card";
import {
  formatReminderTime,
  normalizeDays,
  sameDays,
  type ReminderDay,
} from "./schedule";

interface ReminderState {
  time: string;
  days: ReminderDay[];
  isActive: boolean;
  budgetAlertEnabled: boolean;
}

type SaveKind = "schedule" | "active" | "budget";

function toState(reminder: ReminderDTO): ReminderState {
  return {
    time: reminder.time,
    days: normalizeDays(reminder.days),
    isActive: reminder.isActive,
    budgetAlertEnabled: reminder.budgetAlertEnabled,
  };
}

function toMinutes(value: string): number | null {
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/** Catat sekali per sesi di sessionStorage; tetap tampil bila storage diblokir. */
function markOnce(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

/**
 * Pengaturan pengingat harian: jadwal, pratinjau notifikasi, peringatan batas
 * belanja, dan notifikasi browser. Semua mutasi memakai PUT /api/reminders.
 */
export function ReminderSettings({
  reminder,
  usage,
  currency,
  userEmail,
}: {
  reminder: ReminderDTO;
  usage: BudgetUsageDTO;
  currency: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState<ReminderState>(() => toState(reminder));
  const [draftTime, setDraftTime] = React.useState(reminder.time);
  const [draftDays, setDraftDays] = React.useState<ReminderDay[]>(() =>
    normalizeDays(reminder.days),
  );
  const [saving, setSaving] = React.useState<SaveKind | null>(null);
  const [initialReminder] = React.useState<ReminderDTO>(() => reminder);

  const dirty = draftTime !== saved.time || !sameDays(draftDays, saved.days);

  async function persist(next: ReminderState, successMessage: string, kind: SaveKind) {
    const previous = saved;
    setSaved(next); // optimistis supaya sakelar langsung terasa responsif
    setSaving(kind);
    try {
      const result = await apiPut<{ reminder: ReminderDTO }>("/api/reminders", {
        time: next.time,
        days: next.days,
        isActive: next.isActive,
        budgetAlertEnabled: next.budgetAlertEnabled,
      });
      setSaved(toState(result.reminder));
      toast.success(successMessage);
      router.refresh();
    } catch (error) {
      setSaved(previous);
      toast.error(apiErrorMessage(error) || "Pengingat gagal disimpan. Coba lagi.");
    } finally {
      setSaving(null);
    }
  }

  function handleToggleActive(active: boolean) {
    if (saving) return;
    void persist(
      { ...saved, isActive: active },
      active ? "Pengingat catat harian diaktifkan." : "Pengingat catat harian dimatikan.",
      "active",
    );
  }

  function handleToggleBudgetAlert(enabled: boolean) {
    if (saving) return;
    void persist(
      { ...saved, budgetAlertEnabled: enabled },
      enabled
        ? "Peringatan batas belanja diaktifkan."
        : "Peringatan batas belanja dimatikan.",
      "budget",
    );
  }

  async function handleSaveSchedule() {
    if (saving || !dirty) return;
    if (draftDays.length === 0) {
      toast.error("Pilih minimal satu hari aktif.");
      return;
    }
    await persist(
      { ...saved, time: draftTime, days: draftDays },
      "Jadwal pengingat disimpan.",
      "schedule",
    );
  }

  function handleResetSchedule() {
    setDraftTime(saved.time);
    setDraftDays(saved.days);
  }

  // Dorongan kecil sekali per sesi: pengingat catat saat jam/hari cocok,
  // atau peringatan batas belanja bila pemakaian sudah mendekati/melewati batas.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.visibilityState === "hidden") return;

    const today = todayWeekday();
    const currentMinutes = toMinutes(nowTime());
    const scheduledMinutes = toMinutes(initialReminder.time);
    const dayMatches = normalizeDays(initialReminder.days).includes(today);
    const timeMatches =
      currentMinutes !== null &&
      scheduledMinutes !== null &&
      currentMinutes >= scheduledMinutes &&
      currentMinutes - scheduledMinutes <= 59;

    if (initialReminder.isActive && dayMatches && timeMatches) {
      const key = `catatku:pengingat-toast:${todayISO()}:${initialReminder.time}`;
      if (markOnce(key)) {
        toast("Waktunya mencatat pengeluaran hari ini 💸", {
          description: `Pengingat ${formatReminderTime(initialReminder.time)} — catat pengeluaranmu supaya rapi.`,
          duration: 9000,
          action: {
            label: "Catat sekarang",
            onClick: () => router.push("/catat"),
          },
        });
        return;
      }
    }

    if (
      initialReminder.budgetAlertEnabled &&
      (usage.status === "warning" || usage.status === "over")
    ) {
      const key = `catatku:batas-toast:${todayISO()}:${usage.period}:${usage.status}`;
      if (markOnce(key)) {
        toast(
          usage.status === "over"
            ? "Batas belanja bulan ini sudah terlewati"
            : "Pengeluaranmu mendekati batas belanja",
          {
            description: `Sudah ${usage.percent}% dari batas ${formatMoney(
              usage.budget?.limitAmount ?? 0,
              currency,
            )} bulan ini.`,
            duration: 9000,
            action: {
              label: "Lihat batas",
              onClick: () => router.push("/target"),
            },
          },
        );
      }
    }
  }, [initialReminder, usage, currency, router]);

  return (
    <div className="space-y-4">
      <ReminderScheduleCard
        time={draftTime}
        days={draftDays}
        isActive={saved.isActive}
        dirty={dirty}
        saving={saving !== null}
        onTimeChange={setDraftTime}
        onDaysChange={(days) => setDraftDays(normalizeDays(days))}
        onToggleActive={handleToggleActive}
        onSave={() => void handleSaveSchedule()}
        onReset={handleResetSchedule}
      />

      <NotificationPreview
        time={draftTime}
        days={draftDays}
        isActive={saved.isActive}
      />

      <BudgetAlertCard
        usage={usage}
        currency={currency}
        enabled={saved.budgetAlertEnabled}
        saving={saving !== null}
        onToggle={handleToggleBudgetAlert}
      />

      <BrowserNotificationsCard />

      <p className="px-1 pb-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        Pengaturan pengingat ini khusus untuk akun{" "}
        <span className="font-semibold text-foreground">{userEmail}</span> dan hanya tersimpan
        pada akun tersebut.
      </p>
    </div>
  );
}
