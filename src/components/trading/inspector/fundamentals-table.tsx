/**
 * Tabel fundamental SEC (XBRL) untuk halaman Inspeksi Saham.
 * Nilai dolar AS, bukan sen — lihat catatan di src/lib/trading/types.ts.
 *
 * Selalu di dalam <Disclosure> "Fundamental (lanjutan)".
 * Mobile hanya menampilkan 4 kolom inti (Periode, Pendapatan, Laba bersih,
 * EPS); kolom margin muncul mulai layar `sm` supaya tidak terpotong.
 */

import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Disclosure, StatTile } from "@/components/trading/ui";
import {
  fmtDate,
  fmtEtDateTime,
  fmtPct,
  fmtUsdCompact,
  fmtUsdDollars,
} from "@/lib/trading/format";
import type { FundamentalsDTO, FundamentalsPeriod } from "@/lib/trading/types";

const PLAIN_ONE_DECIMAL = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function fmtMargin(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${PLAIN_ONE_DECIMAL.format(value)}%`;
}

/**
 * EPS bisa sangat kecil (mis. 0,004); tampilkan lebih banyak desimal supaya
 * tidak salah terbaca "0,00". Nilai kosong tetap "—", bukan nol.
 */
function fmtEps(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const tiny = Math.abs(value) > 0 && Math.abs(value) < 0.1;
  return fmtUsdDollars(value, tiny ? 4 : 2);
}

function PeriodRow({
  period,
  highlight = false,
}: {
  period: FundamentalsPeriod;
  highlight?: boolean;
}) {
  return (
    <tr
      className={
        highlight
          ? "border-b border-border/50 bg-primary-soft/40 text-right font-semibold"
          : "border-b border-border/50 text-right"
      }
    >
      <th scope="row" className="py-2 pr-1 text-left font-semibold sm:pr-2">
        <span className="block text-[11.5px] sm:text-[12.5px]">{period.label}</span>
        <span className="block text-[9.5px] font-normal text-muted-foreground sm:text-[10.5px]">
          {fmtDate(period.end)}
        </span>
      </th>
      <td className="money whitespace-nowrap py-2 pl-1 text-[11.5px] sm:px-2 sm:text-[12.5px]">
        {fmtUsdCompact(period.revenue)}
      </td>
      <td className="money whitespace-nowrap py-2 pl-1 text-[11.5px] sm:px-2 sm:text-[12.5px]">
        {fmtUsdCompact(period.netIncome)}
      </td>
      <td className="money whitespace-nowrap py-2 pl-1 text-[11.5px] sm:px-2 sm:text-[12.5px]">
        {fmtEps(period.epsDiluted)}
      </td>
      <td className="money hidden whitespace-nowrap px-2 py-2 sm:table-cell">
        {fmtMargin(period.grossMargin)}
      </td>
      <td className="money hidden whitespace-nowrap px-2 py-2 sm:table-cell">
        {fmtMargin(period.operatingMargin)}
      </td>
      <td className="money hidden whitespace-nowrap px-2 py-2 sm:table-cell">
        {fmtMargin(period.netMargin)}
      </td>
    </tr>
  );
}

export function FundamentalsTable({ fundamentals }: { fundamentals: FundamentalsDTO | null }) {
  const quarters = fundamentals?.periods.filter((period) => period.kind === "quarter") ?? [];
  const year = fundamentals?.periods.find((period) => period.kind === "year") ?? null;
  const ttm = fundamentals?.ttm ?? null;
  const yoy = fundamentals?.yoy ?? null;
  const available = quarters.length > 0 || year !== null;
  const source = fundamentals?.source ?? "SEC EDGAR XBRL tidak tersedia untuk simbol ini.";

  const revenueHint =
    yoy?.revenuePct === null || yoy?.revenuePct === undefined
      ? "Jumlah 4 kuartal terakhir"
      : `4 kuartal · ${fmtPct(yoy.revenuePct, 1)} dari tahun lalu`;
  const netIncomeHint =
    yoy?.netIncomePct === null || yoy?.netIncomePct === undefined
      ? "Jumlah 4 kuartal terakhir"
      : `4 kuartal · ${fmtPct(yoy.netIncomePct, 1)} dari tahun lalu`;

  return (
    <Disclosure
      title="Fundamental (lanjutan)"
      hint="Pendapatan, laba, EPS, dan margin per kuartal dari laporan SEC (10-Q/10-K)."
    >
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] leading-snug text-muted-foreground">
            Semua angka dalam dolar AS per saham/laporan.
          </p>
          {fundamentals?.cik ? <Badge tone="outline">CIK {fundamentals.cik}</Badge> : null}
        </div>

        {ttm ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile label="Pendapatan 1 tahun" value={fmtUsdCompact(ttm.revenue)} hint={revenueHint} />
            <StatTile label="Laba bersih 1 tahun" value={fmtUsdCompact(ttm.netIncome)} hint={netIncomeHint} />
            <StatTile
              className="col-span-2 sm:col-span-1"
              label="EPS 1 tahun"
              value={fmtUsdDollars(ttm.epsDiluted)}
              hint="Jumlah 4 kuartal terakhir"
            />
          </div>
        ) : null}

        {available ? (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full table-fixed border-collapse text-[11.5px] sm:min-w-[560px] sm:table-auto sm:text-[12.5px]">
              <caption className="sr-only">
                Ringkasan pendapatan, laba bersih, EPS, dan margin per kuartal dari SEC EDGAR (dolar
                AS)
              </caption>
              <thead>
                <tr className="border-b border-border/80 text-right text-[9.5px] uppercase tracking-[0.05em] text-muted-foreground sm:text-[10.5px]">
                  <th scope="col" className="w-1/4 py-2 pr-1 text-left font-semibold sm:w-auto sm:pr-2">
                    Periode
                  </th>
                  <th scope="col" className="py-2 pl-1 font-semibold sm:px-2">
                    Pendapatan
                  </th>
                  <th scope="col" className="py-2 pl-1 font-semibold sm:px-2">
                    Laba bersih
                  </th>
                  <th scope="col" className="py-2 pl-1 font-semibold sm:px-2">
                    EPS
                  </th>
                  <th scope="col" className="hidden px-2 py-2 font-semibold sm:table-cell">
                    Margin kotor
                  </th>
                  <th scope="col" className="hidden px-2 py-2 font-semibold sm:table-cell">
                    Margin operasi
                  </th>
                  <th scope="col" className="hidden px-2 py-2 font-semibold sm:table-cell">
                    Margin bersih
                  </th>
                </tr>
              </thead>
              <tbody>
                {quarters.map((period) => (
                  <PeriodRow key={`q-${period.end}`} period={period} />
                ))}
                {year ? <PeriodRow key={`y-${year.end}`} period={year} highlight /> : null}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3.5">
            <p className="flex items-center gap-2 text-[13px] font-semibold">
              <TriangleAlert className="size-4 text-warning" aria-hidden="true" />
              Fundamental SEC belum tersedia
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{source}</p>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Sumber: {source}
          {fundamentals?.updatedAt ? ` · diperbarui ${fmtEtDateTime(fundamentals.updatedAt)}` : ""}
          {fundamentals?.companyName ? ` · ${fundamentals.companyName}` : ""}. EPS = laba per saham.
          Pendapatan & laba dibulatkan dengan satuan (juta/miliar). Angka kuartalan bisa berbeda dari
          rilis pers karena penyesuaian pelaporan.
        </p>
      </div>
    </Disclosure>
  );
}
