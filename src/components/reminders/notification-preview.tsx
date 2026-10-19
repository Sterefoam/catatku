"use client";

import Link from "next/link";
import { ArrowRight, BellRing, Smartphone } from "lucide-react";
import { Logo } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  describeDays,
  describeScheduleShort,
  formatReminderTime,
  type ReminderDay,
} from "./schedule";

/** Pratinjau notifikasi bergaya notifikasi HP. */
export function NotificationPreview({
  time,
  days,
  isActive,
}: {
  time: string;
  days: ReminderDay[];
  isActive: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Smartphone className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">Pratinjau notifikasi</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            Seperti ini pengingatmu terlihat di layar HP.
          </p>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="rounded-[1.6rem] bg-[linear-gradient(155deg,#0c1713_0%,#0d2b22_58%,#0a3d2e_100%)] p-3 shadow-[0_16px_30px_-24px_rgba(5,40,28,0.9)]">
          <div className="flex items-center justify-between px-1 pb-2 text-[10px] font-medium text-white/45">
            <span>Catatku</span>
            <span>sekarang</span>
          </div>

          {isActive ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <Logo size={26} />
                <p className="text-[11.5px] font-semibold tracking-wide text-white/85">Catatku</p>
                <span className="ml-auto size-1.5 rounded-full bg-emerald-300" aria-hidden />
              </div>
              <p className="mt-2 text-[13px] font-semibold leading-snug text-white">
                Waktunya mencatat pengeluaran hari ini 💸
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/55">
                Ketuk untuk membuka catat transaksi.
              </p>
              <Link
                href="/catat"
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-emerald-200 transition-colors hover:bg-white/15"
              >
                Buka catat transaksi <ArrowRight className="size-3" />
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center">
              <p className="text-[12px] leading-relaxed text-white/55">
                Pengingat nonaktif — tidak ada notifikasi yang dikirim.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface/60 px-3.5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-xl",
                isActive ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
              )}
            >
              <BellRing className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold">
                {isActive ? "Jadwal aktif" : "Jadwal nonaktif"}
              </p>
              <p className="truncate text-[11.5px] text-muted-foreground">
                {isActive
                  ? describeScheduleShort({ time, days, isActive })
                  : "Nyalakan pengingat untuk mulai diingatkan."}
              </p>
            </div>
          </div>
          <Badge tone={isActive ? "success" : "neutral"} className="shrink-0">
            {isActive ? "Aktif" : "Nonaktif"}
          </Badge>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Pesan contoh: <span className="font-medium text-foreground">
            {isActive
              ? `“Waktunya mencatat pengeluaran hari ini 💸” — ${describeDays(days).toLowerCase()} pukul ${formatReminderTime(time)}.`
              : "nyalakan pengingat untuk melihat contohnya."}
          </span>
        </p>
      </div>
    </Card>
  );
}
