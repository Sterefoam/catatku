/**
 * Detail teknikal halaman Inspeksi Saham.
 *
 * Selalu di dalam <Disclosure> (tertutup default) karena ini informasi
 * lanjutan; yang penting tampil dulu di header harga & kartu setup.
 */

import { Badge } from "@/components/ui/badge";
import { Disclosure, StatTile } from "@/components/trading/ui";
import { fmtPct, fmtPrice, fmtVolume } from "@/lib/trading/format";
import type { Technicals } from "@/lib/trading/types";

function diffPct(price: number, level: number | null): number | null {
  if (level === null || level <= 0) return null;
  return ((price - level) / level) * 100;
}

function plainPct(value: number, digits = 1): string {
  return `${Math.abs(value).toFixed(digits).replace(".", ",")}%`;
}

function priceRange(low: number | null, high: number | null): string {
  if (low === null || high === null || low <= 0 || high <= 0) return "—";
  return `${fmtPrice(low)}–${fmtPrice(high)}`;
}

export function TechnicalsCard({ technicals }: { technicals: Technicals }) {
  const last = technicals.last;
  const sma20Diff = diffPct(last, technicals.sma20);
  const sma50Diff = diffPct(last, technicals.sma50);
  const rsi = technicals.rsi14;
  const relVolume = technicals.relVolume;
  const high20 = technicals.high20;
  const low20 = technicals.low20;
  const range = technicals.openingRange;

  const rsiHint =
    rsi === null
      ? "Butuh minimal 15 sesi harian"
      : rsi >= 70
        ? "0–100 · di atas 70 (panas)"
        : rsi <= 30
          ? "0–100 · di bawah 30 (dingin)"
          : "0–100 · 30–70 netral";

  const relVolumeTone =
    relVolume !== null && relVolume >= 1.5
      ? "success"
      : relVolume !== null && relVolume < 0.7
        ? "warning"
        : "default";

  return (
    <Disclosure
      title="Detail teknikal"
      hint="RSI, rata-rata harga 20 & 50 hari, ayunan harga (ATR), volume, rentang awal 15 menit."
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            label="RSI 14"
            value={rsi === null ? "—" : rsi.toFixed(1).replace(".", ",")}
            hint={rsiHint}
            tone={rsi !== null && (rsi >= 70 || rsi <= 30) ? "warning" : "default"}
          />
          <StatTile
            label="Rata-rata 20 hari"
            value={technicals.sma20 === null ? "—" : fmtPrice(technicals.sma20)}
            hint={
              sma20Diff === null
                ? "Belum cukup data"
                : `Harga ${fmtPct(sma20Diff, 1)} dari rata-rata`
            }
            tone={sma20Diff === null ? "default" : sma20Diff >= 0 ? "success" : "danger"}
          />
          <StatTile
            label="Rata-rata 50 hari"
            value={technicals.sma50 === null ? "—" : fmtPrice(technicals.sma50)}
            hint={
              sma50Diff === null
                ? "Belum cukup data"
                : `Harga ${fmtPct(sma50Diff, 1)} dari rata-rata`
            }
            tone={sma50Diff === null ? "default" : sma50Diff >= 0 ? "success" : "danger"}
          />
          <StatTile
            label="Ayunan harga (ATR)"
            value={technicals.atr14 === null ? "—" : fmtPrice(technicals.atr14)}
            hint={
              technicals.atrPct === null
                ? "Belum cukup data"
                : `≈ ${plainPct(technicals.atrPct)} dari harga (14 sesi)`
            }
            tone={technicals.atrPct !== null && technicals.atrPct >= 5 ? "warning" : "default"}
          />
          <StatTile
            label="Tertinggi 20 hari"
            value={high20 === null ? "—" : fmtPrice(high20)}
            hint={
              high20 === null
                ? "Belum cukup data"
                : last > high20
                  ? "Harga sudah menembus"
                  : "Harga masih di bawah"
            }
            tone={high20 !== null && last > high20 ? "success" : "default"}
          />
          <StatTile
            label="Terendah 20 hari"
            value={low20 === null ? "—" : fmtPrice(low20)}
            hint={
              low20 === null
                ? "Belum cukup data"
                : last < low20
                  ? "Harga sudah di bawah"
                  : "Harga masih di atas"
            }
            tone={low20 !== null && last < low20 ? "danger" : "default"}
          />
          <StatTile
            label="Volume rata-rata"
            value={fmtVolume(technicals.avgVolume20)}
            hint="lembar per sesi (20 sesi)"
          />
          <StatTile
            label="Volume vs biasanya"
            value={relVolume === null ? "—" : `${relVolume.toFixed(2).replace(".", ",")}×`}
            hint={
              relVolume === null
                ? "Volume sesi ini belum ada"
                : relVolume >= 1.5
                  ? "1× = biasa · sekarang ramai"
                  : relVolume < 0.7
                    ? "1× = biasa · sekarang sepi"
                    : "1× = seperti biasanya"
            }
            tone={relVolumeTone}
          />
        </div>

        <div className="grid gap-2 text-[11.5px] leading-relaxed text-muted-foreground sm:grid-cols-3">
          <p>
            Rentang sesi:{" "}
            <span className="money font-semibold text-foreground">
              {priceRange(technicals.dayLow, technicals.dayHigh)}
            </span>
          </p>
          <p>
            Rentang 52 minggu:{" "}
            <span className="money font-semibold text-foreground">
              {priceRange(technicals.low52w, technicals.high52w)}
            </span>
          </p>
          <p>
            Volume sesi ini:{" "}
            <span className="money font-semibold text-foreground">
              {fmtVolume(technicals.volume)}
            </span>{" "}
            lembar
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface/40 px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Rentang awal (15 menit pertama)
            </p>
            {range ? (
              <Badge tone={range.complete ? "primary" : "warning"}>
                {range.complete ? "Lengkap" : `Baru ${range.bars} bar`}
              </Badge>
            ) : (
              <Badge tone="neutral">Belum terbentuk</Badge>
            )}
          </div>
          {range ? (
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Tertinggi
                </p>
                <p className="money text-[14px] font-bold">{fmtPrice(range.high)}</p>
              </div>
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Tengah
                </p>
                <p className="money text-[14px] font-bold">{fmtPrice(range.mid)}</p>
              </div>
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Terendah
                </p>
                <p className="money text-[14px] font-bold">{fmtPrice(range.low)}</p>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
              Belum ada bar 5 menit yang membentuk rentang awal — pasar mungkin belum buka.
            </p>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          RSI = kekuatan beli/jual 0–100. Rata-rata harga = MA20/MA50. Ayunan harga (ATR) =
          rata-rata gerak 14 sesi. Angka dihitung dari bar harian & 5 menit Yahoo Finance.
        </p>
      </div>
    </Disclosure>
  );
}
