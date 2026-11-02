/**
 * Grafik SVG sederhana untuk halaman Inspeksi Saham (tanpa library chart).
 * Halaman inspeksi adalah server component, jadi komponen ini juga server.
 */

import { fmtDate, fmtPrice } from "@/lib/trading/format";
import { getEtParts, minutesToHHMM } from "@/lib/trading/market-clock";
import type { Bar, CandleSeries, MarketStatus, OpeningRange } from "@/lib/trading/types";
import { cn } from "@/lib/utils";

type Tone = "warning" | "muted" | "success" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  warning: "text-warning",
  muted: "text-muted-foreground",
  success: "text-success",
  danger: "text-danger",
};

const ET_SHORT_DAY = new Intl.DateTimeFormat("id-ID", {
  timeZone: "America/New_York",
  weekday: "short",
  day: "numeric",
  month: "short",
});

interface GuideLine {
  value: number;
  label: string;
  tone: Tone;
}

/** "14:05" (jam ET tanpa akhiran, untuk rentang jam). */
function etTimeShort(unixSeconds: number): string {
  return minutesToHHMM(getEtParts(new Date(unixSeconds * 1000)).minutes);
}

/** "Sen, 2 Nov" — hari bursa sebuah bar. */
function etDayLabel(unixSeconds: number): string {
  return ET_SHORT_DAY.format(new Date(unixSeconds * 1000));
}

/** "2026-11-02" (ET) — untuk membandingkan sesi. */
function etSessionDate(unixSeconds: number): string {
  return getEtParts(new Date(unixSeconds * 1000)).dateISO;
}

function EmptyChart({ label, height }: { label: string; height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-4 text-center text-[11.5px] leading-snug text-muted-foreground"
      style={{ height }}
    >
      {label}
    </div>
  );
}

function GuideLegend({ guides }: { guides: GuideLine[] }) {
  if (!guides.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
      {guides.map((guide) => (
        <li
          key={`${guide.label}-${guide.value}`}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          <span
            className={cn("inline-block h-0.5 w-3.5 rounded-full bg-current", TONE_CLASS[guide.tone])}
            aria-hidden="true"
          />
          <span>{guide.label}</span>
          <span className="money font-semibold text-foreground">{fmtPrice(guide.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function LineChart({
  bars,
  guides = [],
  height = 150,
  ariaLabel,
  emptyLabel,
}: {
  bars: Bar[];
  guides?: GuideLine[];
  height?: number;
  ariaLabel: string;
  emptyLabel: string;
}) {
  const values = bars.map((bar) => bar.c).filter((value) => Number.isFinite(value) && value > 0);
  if (values.length < 2) return <EmptyChart label={emptyLabel} height={height} />;

  const allValues = [...values, ...guides.map((guide) => guide.value)];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const width = 100;
  const boxHeight = 40;
  const pad = 2;

  const x = (index: number) => (index / (values.length - 1)) * width;
  const y = (value: number) => pad + (1 - (value - min) / span) * (boxHeight - pad * 2);
  const points = values.map((value, index) => `${x(index).toFixed(2)},${y(value).toFixed(2)}`);
  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${width},${boxHeight} L0,${boxHeight} Z`;

  const first = values[0] as number;
  const last = values[values.length - 1] as number;
  const up = last >= first;

  return (
    <svg
      viewBox={`0 0 ${width} ${boxHeight}`}
      preserveAspectRatio="none"
      className={cn("w-full", up ? "text-success" : "text-danger")}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <g className="text-muted-foreground" opacity={0.16}>
        {[0, 0.5, 1].map((ratio) => {
          const gridY = pad + ratio * (boxHeight - pad * 2);
          return (
            <line
              key={ratio}
              x1={0}
              x2={width}
              y1={gridY}
              y2={gridY}
              stroke="currentColor"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>
      <path d={areaPath} fill="currentColor" opacity={0.1} />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {guides.map((guide) => (
        <line
          key={`${guide.label}-${guide.value}`}
          x1={0}
          x2={width}
          y1={y(guide.value)}
          y2={y(guide.value)}
          className={TONE_CLASS[guide.tone]}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
          opacity={0.85}
        />
      ))}
    </svg>
  );
}

/**
 * Grafik intraday 5 menit + garis rentang awal & harga tutup sebelumnya.
 * `market` dipakai supaya label sesi jujur: saat pra-pasar data 5 menit masih
 * milik sesi sebelumnya, jadi ditulis "Sesi terakhir (Jum, 30 Okt)", bukan
 * "hari ini".
 */
export function IntradayChart({
  series,
  openingRange,
  prevClose,
  market,
  height = 160,
}: {
  series: CandleSeries | null;
  openingRange: OpeningRange | null;
  prevClose: number;
  market: MarketStatus;
  height?: number;
}) {
  const bars = series?.bars ?? [];
  if (bars.length < 2) {
    return (
      <EmptyChart
        label="Grafik 5 menit belum ada — mungkin pasar belum buka atau data sesi ini kosong."
        height={height}
      />
    );
  }

  const guides: GuideLine[] = [];
  if (openingRange) {
    const suffix = openingRange.complete ? "" : " (belum lengkap)";
    guides.push({
      value: openingRange.high,
      label: `Rentang awal tertinggi${suffix}`,
      tone: "warning",
    });
    guides.push({
      value: openingRange.low,
      label: `Rentang awal terendah${suffix}`,
      tone: "warning",
    });
  }
  if (prevClose > 0) {
    guides.push({ value: prevClose, label: "Harga tutup sebelumnya", tone: "muted" });
  }

  const firstBar = bars[0] as Bar;
  const lastBar = bars[bars.length - 1] as Bar;
  const sameSession = etSessionDate(lastBar.t) === market.sessionDate;
  const sessionLabel = sameSession
    ? "Sesi hari ini"
    : `Sesi terakhir (${etDayLabel(lastBar.t)})`;

  return (
    <figure className="space-y-1">
      <LineChart
        bars={bars}
        guides={guides}
        height={height}
        ariaLabel={`Grafik harga 5 menit ${series?.symbol ?? ""}, ${sessionLabel}`}
        emptyLabel="Grafik 5 menit belum ada."
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/80">{sessionLabel}</span>
        <span>
          {etTimeShort(firstBar.t)}–{etTimeShort(lastBar.t)} ET
        </span>
        <span>{bars.length} bar 5 menit</span>
      </div>
      <GuideLegend guides={guides} />
    </figure>
  );
}

/** Grafik tren harian (default 3 bulan) + garis level 20 hari. */
export function DailyChart({
  series,
  high20,
  low20,
  height = 150,
}: {
  series: CandleSeries | null;
  high20?: number | null;
  low20?: number | null;
  height?: number;
}) {
  const bars = series?.bars ?? [];
  if (bars.length < 2) {
    return <EmptyChart label="Grafik harian belum ada." height={height} />;
  }

  const guides: GuideLine[] = [];
  if (high20 && high20 > 0) {
    guides.push({ value: high20, label: "Tertinggi 20 hari", tone: "warning" });
  }
  if (low20 && low20 > 0) {
    guides.push({ value: low20, label: "Terendah 20 hari", tone: "success" });
  }

  const highest = Math.max(...bars.map((bar) => bar.h));
  const lowest = Math.min(...bars.map((bar) => bar.l));
  const firstBar = bars[0] as Bar;
  const lastBar = bars[bars.length - 1] as Bar;
  const firstISO = new Date(firstBar.t * 1000).toISOString();
  const lastISO = new Date(lastBar.t * 1000).toISOString();

  return (
    <figure className="space-y-1">
      <LineChart
        bars={bars}
        guides={guides}
        height={height}
        ariaLabel={`Grafik harga harian ${series?.symbol ?? ""} ${series?.range ?? ""}`}
        emptyLabel="Grafik harian belum ada."
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          {bars.length} sesi · {fmtDate(firstISO)}–{fmtDate(lastISO)}
        </span>
        <span>
          Tertinggi <span className="money font-semibold text-foreground">{fmtPrice(highest)}</span>
          {" · "}Terendah{" "}
          <span className="money font-semibold text-foreground">{fmtPrice(lowest)}</span>
        </span>
      </div>
      <GuideLegend guides={guides} />
    </figure>
  );
}
