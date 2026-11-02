"use client";

import * as React from "react";
import { Dices, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/trading/ui";
import { apiErrorMessage, apiPost } from "@/lib/client-api";
import { fmtR } from "@/lib/trading/format";
import type { TimeMachineResult } from "@/lib/trading/types";

function pctText(value: number, digits = 1): string {
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

/**
 * Uji peluang (Time Machine): simulasi bootstrap dari bar 5 menit historis.
 * Tombol baru aktif setelah pratinjau rencana valid; hasilnya bukan prediksi.
 */
export function TimeMachinePanel({
  symbol,
  entry,
  stop,
  target,
}: {
  symbol: string;
  entry: number;
  stop: number;
  target: number;
}) {
  const [sim, setSim] = React.useState<TimeMachineResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<{ sim: TimeMachineResult }>("/api/trading/timemachine", {
        symbol,
        entry,
        stop,
        target,
      });
      setSim(data.sim);
      toast.success("Simulasi selesai. Ingat: hasil historis bukan prediksi.");
    } catch (requestError) {
      const message = apiErrorMessage(requestError);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-border/70 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Dices className="size-4 text-primary" aria-hidden="true" />
            Uji peluang (simulasi)
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Simulasi 2.000 sesi dari data 5 menit historis, memakai harga masuk, batas rugi, dan
            target rencana ini.
          </p>
        </div>
        <Button size="sm" variant="soft" onClick={run} disabled={loading}>
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : sim ? (
            <RotateCcw className="size-3.5" aria-hidden="true" />
          ) : (
            <Dices className="size-3.5" aria-hidden="true" />
          )}
          {loading ? "Menghitung..." : sim ? "Hitung ulang" : "Uji peluang"}
        </Button>
      </div>

      {loading ? (
        <p className="rounded-2xl bg-surface/70 px-3.5 py-2.5 text-[12px] text-muted-foreground">
          Menghitung 2.000 simulasi dari bar 5 menit historis. Proses ini bisa 5–10 detik — halaman
          tetap bisa dipakai.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl bg-danger-soft/60 px-3.5 py-2.5 text-[12.5px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      {sim ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <StatTile
              label="Target kena dulu"
              value={pctText(sim.targetFirstPct)}
              tone="success"
              hint={`${sim.simulations.toLocaleString("id-ID")} simulasi`}
            />
            <StatTile
              label="Batas rugi dulu"
              value={pctText(sim.stopFirstPct)}
              tone="danger"
              hint="setiap kena batas rugi = 1R"
            />
            <StatTile label="Tidak keduanya" value={pctText(sim.neitherPct)} hint="sampai penutupan" />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            <span>
              Rata-rata hasil{" "}
              <span className="money font-semibold text-foreground">{fmtR(sim.avgR, 2)}</span> per
              trade
            </span>
            <span aria-hidden="true">·</span>
            <span>{sim.historySessions} sesi historis</span>
            <span aria-hidden="true">·</span>
            <span>
              tutup di atas harga masuk {pctText(sim.closeUpPct)}, di bawah {pctText(sim.closeDownPct)}
            </span>
          </div>

          {sim.assumptions.length ? (
            <ul className="space-y-1 rounded-2xl bg-muted/40 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {sim.assumptions.slice(0, 5).map((item) => (
                <li key={item} className="flex gap-1.5">
                  <span aria-hidden="true">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <Badge tone="warning">Simulasi data historis — bukan prediksi</Badge>
        </div>
      ) : null}
    </div>
  );
}
