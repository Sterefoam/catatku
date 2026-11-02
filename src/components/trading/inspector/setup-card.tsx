/**
 * Daftar pola (setup) yang cocok dengan aturan scanner untuk satu saham.
 * Bahasa label sengaja dibuat manusiawi; detail dari engine ditampilkan apa
 * adanya.
 */

import { Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionTitle, SetupPill } from "@/components/trading/ui";
import type { SetupKey, SetupTag } from "@/lib/trading/types";

const SETUP_LABEL_HUMAN: Record<SetupKey, string> = {
  breakout_20d: "Tembus tertinggi 20 hari",
  bull_flag: "Bendera banteng (naik lalu istirahat)",
  reclaim_ma20: "Kembali di atas rata-rata 20 hari",
  oversold: "Jenuh jual (harga turun terlalu jauh)",
  oversold_bounce: "Pantulan setelah jenuh jual",
  orb_breakout: "Tembus rentang awal 15 menit",
};

export function SetupCard({ setups }: { setups: SetupTag[] }) {
  return (
    <Card>
      <CardContent className="space-y-3.5 p-4 sm:p-5">
        <SectionTitle
          title="Cocok dengan aturan"
          hint="Pola (setup) yang lolos aturan pencarian — bukan rekomendasi beli. Tetap tentukan batas rugi (stop) & target untung."
        />
        {setups.length === 0 ? (
          <EmptyState
            compact
            icon={<Target className="size-5" aria-hidden="true" />}
            title="Belum ada pola yang cocok"
            description="Harga belum memenuhi salah satu aturan: tembus tertinggi 20 hari, bendera banteng, kembali di atas rata-rata 20 hari, jenuh jual, atau tembus rentang awal hari ini."
          />
        ) : (
          <ul className="space-y-2.5">
            {setups.map((setup) => (
              <li
                key={setup.key}
                className="rounded-2xl border border-border/70 bg-surface/40 px-3.5 py-3"
              >
                <SetupPill setup={{ ...setup, label: SETUP_LABEL_HUMAN[setup.key] ?? setup.label }} />
                <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">
                  {setup.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
