"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ListChecks,
  Loader2,
  Radar,
  RefreshCw,
  Search,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Disclosure, SectionTitle } from "@/components/trading/ui";
import { apiErrorMessage, apiGet, apiPost } from "@/lib/client-api";
import { fmtEtDateTime } from "@/lib/trading/format";
import {
  AFTERHOURS_END_MINUTES,
  MARKET_OPEN_MINUTES,
  PREMARKET_MINUTES,
  getEtParts,
  isTradingDay,
  minutesToHHMM,
} from "@/lib/trading/market-clock";
import type {
  MarketStatus,
  ScanMode,
  ScanResult,
  SetupKey,
  SetupTag,
} from "@/lib/trading/types";
import { cn } from "@/lib/utils";
import { ScanHitCard } from "./scan-hit-card";

const UNIVERSE_OPTIONS = [
  { value: "sp100", label: "100 saham likuid (kurasi)", total: 100 },
  { value: "mega", label: "20 saham besar populer", total: 20 },
  { value: "watchlist", label: "Daftar pantau saya", total: null },
] as const;

type ScanUniverse = (typeof UNIVERSE_OPTIONS)[number]["value"];

const LIMIT_OPTIONS: { value: string; label: string }[] = [
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
];

const MODE_OPTIONS = [
  {
    value: "daily" as const,
    label: "Harian (sebelum pasar buka)",
    hint: "Dari harga penutupan — bisa dipakai kapan saja.",
    icon: CalendarDays,
  },
  {
    value: "orb" as const,
    label: "Saat pasar buka (tembus rentang awal)",
    hint: "Butuh pasar buka & rentang awal 15 menit selesai (09.50 ET).",
    icon: Zap,
  },
];

/** Arti singkat nama setup — ditampilkan sekali di bawah judul hasil. */
const SETUP_MEANINGS: Partial<Record<SetupKey, string>> = {
  breakout_20d: "harga menembus harga tertinggi 20 hari terakhir",
  bull_flag: "harga naik cepat lalu diam sebentar, siap lanjut",
  reclaim_ma20: "harga kembali ke atas rata-rata 20 hari",
  oversold: "harga turun terlalu dalam (RSI di bawah 30)",
  oversold_bounce: "setelah jenuh jual, harga mulai berbalik naik",
  orb_breakout: "harga menembus tertinggi rentang 15 menit pertama",
};

function setupMeaning(key: SetupKey): string {
  return SETUP_MEANINGS[key] ?? "harga memenuhi aturan pencarian ini";
}

/** Rentang awal 15 menit + bar konfirmasi → mode ini baru berguna 09.50 ET. */
const ORB_READY_MINUTES = MARKET_OPEN_MINUTES + 20;

/**
 * Kenapa mode "Saat pasar buka" belum bisa dipakai. Memakai jam bursa New York
 * (bukan jam perangkat) supaya pesannya selalu cocok dengan sesi.
 */
function orbGateMessage(): string | null {
  const parts = getEtParts(new Date());
  if (!isTradingDay(parts.dateISO)) {
    return "Hari ini bursa libur, jadi belum ada sesi untuk dipantau. Coba mode Harian dulu.";
  }
  if (parts.minutes < PREMARKET_MINUTES || parts.minutes >= AFTERHOURS_END_MINUTES) {
    return "Bursa sedang tutup. Mode ini butuh pasar buka — coba mode Harian dulu.";
  }
  if (parts.minutes < MARKET_OPEN_MINUTES) {
    return `Pasar belum buka (sekarang ${minutesToHHMM(parts.minutes)} ET, buka 09.30 ET). Coba mode Harian dulu.`;
  }
  if (parts.minutes < ORB_READY_MINUTES) {
    return `Rentang awal 15 menit belum selesai. Mode ini bisa dipakai setelah 09.50 ET (sekarang ${minutesToHHMM(parts.minutes)} ET). Coba mode Harian dulu.`;
  }
  return null;
}

function universeText(key: string): string {
  if (key === "mega") return "20 saham besar";
  if (key === "watchlist") return "Daftar pantau";
  if (key === "symbols") return "Saham pilihan";
  return "100 saham likuid";
}

function universeTotal(key: string): number | null {
  const found = UNIVERSE_OPTIONS.find((option) => option.value === key);
  return found?.total ?? null;
}

function toUniverse(value: string): ScanUniverse {
  return value === "mega" || value === "watchlist" ? value : "sp100";
}

export function ScanPanel({
  initialUniverse,
  market,
}: {
  initialUniverse: string;
  market: MarketStatus;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<ScanMode>("daily");
  const [universe, setUniverse] = React.useState<ScanUniverse>(toUniverse(initialUniverse));
  const [limit, setLimit] = React.useState(100);
  const [result, setResult] = React.useState<ScanResult | null>(null);
  const [gate, setGate] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState<Set<string>>(new Set());
  const [savingSymbol, setSavingSymbol] = React.useState<string | null>(null);

  const runScan = React.useCallback(
    async (options?: { universe?: ScanUniverse; mode?: ScanMode }) => {
      if (loading) return;
      const targetUniverse = options?.universe ?? universe;
      const targetMode = options?.mode ?? mode;

      setError(null);
      setGate(null);

      // Mode "Saat pasar buka" tidak ada gunanya di luar sesi — jelaskan, jangan error.
      if (targetMode === "orb") {
        const blocked = orbGateMessage();
        if (blocked) {
          setResult(null);
          setGate(blocked);
          return;
        }
      }

      setLoading(true);
      try {
        const data = await apiGet<{ scan: ScanResult }>(
          `/api/trading/scan?mode=${targetMode}&universe=${targetUniverse}&limit=${limit}`,
        );
        // Server bisa menolak karena sesi belum siap; jangan tampilkan itu sebagai
        // "tidak ada hasil" (catatan gate-nya khas, bukan daftar pantau kosong).
        const gateNote = /Bursa (sedang )?tutup|Opening range/i.test(data.scan.note ?? "");
        if (data.scan.mode === "orb" && data.scan.scanned === 0 && gateNote) {
          setResult(null);
          setGate(
            orbGateMessage() ??
              "Mode ini belum bisa dipakai sekarang. Coba mode Harian dulu atau ulangi beberapa menit lagi.",
          );
          return;
        }
        setResult(data.scan);
      } catch (scanError) {
        setResult(null);
        setError(apiErrorMessage(scanError));
      } finally {
        setLoading(false);
      }
    },
    [limit, loading, mode, universe],
  );

  const changeMode = (value: ScanMode) => {
    if (value === mode) return;
    setMode(value);
    setResult(null);
    setGate(null);
    setError(null);
  };

  const changeUniverse = (value: string) => {
    setUniverse(toUniverse(value));
    setResult(null);
    setGate(null);
    setError(null);
  };

  const changeLimit = (value: number) => {
    setLimit(value);
    setResult(null);
    setGate(null);
    setError(null);
  };

  const scanWatchlist = () => {
    if (universe !== "watchlist") setUniverse("watchlist");
    setResult(null);
    setGate(null);
    setError(null);
    void runScan({ universe: "watchlist" });
  };

  const useDailyMode = () => {
    setMode("daily");
    setResult(null);
    setGate(null);
    setError(null);
    void runScan({ mode: "daily" });
  };

  const tryMega = () => {
    setUniverse("mega");
    setResult(null);
    setGate(null);
    setError(null);
    void runScan({ universe: "mega" });
  };

  const addToWatchlist = async (symbol: string) => {
    if (added.has(symbol) || savingSymbol) return;
    setSavingSymbol(symbol);
    try {
      await apiPost<{ item: unknown }>("/api/trading/watchlist", { symbol });
      setAdded((previous) => {
        const next = new Set(previous);
        next.add(symbol);
        return next;
      });
      toast.success(`${symbol} masuk daftar pantau.`);
      router.refresh();
    } catch (saveError) {
      toast.error(apiErrorMessage(saveError));
    } finally {
      setSavingSymbol(null);
    }
  };

  const limitCount =
    universe === "watchlist" ? null : Math.min(limit, universeTotal(universe) ?? limit);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Mulai mencari</CardTitle>
          <CardDescription>
            Pilih mode, lalu ketuk “Cari sekarang”. Satu kali cari biasanya 10–30 detik.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3.5">
          <div className="space-y-1.5">
            <span id="scan-mode-label" className="text-[13px] font-semibold text-muted-foreground">
              Mode
            </span>
            <div role="radiogroup" aria-labelledby="scan-mode-label" className="grid gap-2">
              {MODE_OPTIONS.map((option) => {
                const active = option.value === mode;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => changeMode(option.value)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-primary/40 bg-primary-soft/70"
                        : "border-border/80 bg-card hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-xl",
                        active ? "bg-card text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-snug">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                        {option.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="h-11 sm:flex-1"
              onClick={() => void runScan()}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Radar className="size-4" aria-hidden="true" />
              )}
              {loading ? "Mencari…" : "Cari sekarang"}
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:flex-1"
              onClick={scanWatchlist}
              disabled={loading}
            >
              <ListChecks className="size-4" aria-hidden="true" />
              Cari di daftar pantau
            </Button>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Status pasar saat halaman dibuka:{" "}
            <span className="font-semibold text-foreground">{market.label}</span>. Hasil berarti
            “cocok dengan aturan”, bukan ajakan beli.
          </p>
        </CardContent>
      </Card>

      <Disclosure title="Lanjutan" hint="Daftar saham yang dicek & jumlahnya">
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="scan-universe"
              className="text-[13px] font-semibold text-muted-foreground"
            >
              Daftar saham
            </label>
            <Select
              id="scan-universe"
              value={universe}
              onChange={(event) => changeUniverse(event.target.value)}
              className="h-11"
            >
              {UNIVERSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              Kurasi saham AS yang likuid, bukan seluruh pasar. Pilihan ini tidak mengubah aturan
              setup.
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-[13px] font-semibold text-muted-foreground">
              Jumlah saham dicek
            </span>
            <Segmented
              value={String(limit)}
              onChange={(value) => changeLimit(Number(value))}
              options={LIMIT_OPTIONS}
              ariaLabel="Jumlah saham yang dicek"
            />
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              Default 100 saham. Lebih sedikit = lebih cepat, tapi sebagian saham tidak ikut dicek.
            </p>
          </div>
        </div>
      </Disclosure>

      {gate ? <ScanGate message={gate} onUseDaily={useDailyMode} /> : null}

      {error ? <ScanError message={error} onRetry={() => void runScan()} /> : null}

      {loading ? <ScanLoading universe={universe} limitCount={limitCount} /> : null}

      {!loading && !gate && result ? (
        <ScanResults
          result={result}
          added={added}
          savingSymbol={savingSymbol}
          onAdd={addToWatchlist}
          onRetry={() => void runScan()}
          onUseDaily={useDailyMode}
          onTryMega={tryMega}
          onScanWatchlist={scanWatchlist}
        />
      ) : null}

      {!loading && !gate && !result && !error ? (
        <EmptyState
          icon={<Radar className="size-6" aria-hidden="true" />}
          title="Belum ada hasil"
          description="Pilih mode & daftar saham, lalu ketuk “Cari sekarang”. Hasilnya saham yang cocok dengan aturan, bukan ajakan membeli."
        />
      ) : null}
    </div>
  );
}

function ScanLoading({
  universe,
  limitCount,
}: {
  universe: ScanUniverse;
  limitCount: number | null;
}) {
  const label =
    universe === "watchlist"
      ? "daftar pantau kamu"
      : `${universeText(universe).toLowerCase()}${
          limitCount !== null ? ` (${limitCount} saham)` : ""
        }`;
  return (
    <Card aria-busy="true" aria-live="polite">
      <CardContent className="space-y-3 p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
          Mencari di {label}…
        </p>
        <p className="text-[11.5px] leading-snug text-muted-foreground">
          Biasanya 10–30 detik karena saham dicek satu per satu supaya data gratis tidak kelebihan
          beban. Jangan tutup halaman ini dulu.
        </p>
        <div className="space-y-2">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-20 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ScanGate({ message, onUseDaily }: { message: string; onUseDaily: () => void }) {
  return (
    <Card className="border-warning/40 bg-warning-soft/40">
      <CardContent className="flex items-start gap-3 p-4">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0 space-y-1.5">
          <p className="text-[13.5px] font-semibold">Mode ini belum bisa dipakai sekarang</p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">{message}</p>
          <Button variant="soft" size="sm" className="mt-0.5 h-10" onClick={onUseDaily}>
            <CalendarDays className="size-4" aria-hidden="true" />
            Pakai mode Harian
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ScanError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-danger/40 bg-danger-soft/40">
      <CardContent className="flex items-start gap-3 p-4">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="text-[13.5px] font-semibold text-danger">Pencarian gagal</p>
          <p className="text-[12px] leading-snug text-muted-foreground">{message}</p>
          <Button variant="outline" size="sm" className="mt-1.5 h-10" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Coba lagi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Saran tindakan saat tidak ada saham yang cocok — disesuaikan dengan daftar yang dipakai. */
function emptySuggestion(result: ScanResult): string {
  if (result.mode === "orb") {
    return "Belum ada saham yang menembus rentang awal 15 menit saat ini. Coba lagi beberapa menit lagi, atau pakai mode Harian.";
  }
  if (result.universe === "watchlist") {
    return "Tidak ada saham di daftar pantau yang cocok aturan harian saat ini. Tambah saham lain, atau coba 20 saham besar.";
  }
  if (result.universe === "mega") {
    return "Tidak ada saham di 20 saham besar yang cocok aturan harian saat ini. Coba cari di daftar pantau, atau ulangi beberapa saat lagi.";
  }
  return "Tidak ada saham di 100 saham likuid yang cocok aturan harian saat ini. Coba 20 saham besar, cari di daftar pantau, atau ulangi beberapa saat lagi.";
}

function ScanResults({
  result,
  added,
  savingSymbol,
  onAdd,
  onRetry,
  onUseDaily,
  onTryMega,
  onScanWatchlist,
}: {
  result: ScanResult;
  added: Set<string>;
  savingSymbol: string | null;
  onAdd: (symbol: string) => void;
  onRetry: () => void;
  onUseDaily: () => void;
  onTryMega: () => void;
  onScanWatchlist: () => void;
}) {
  const modeLabel = result.mode === "daily" ? "Harian" : "Saat pasar buka";
  const total = universeTotal(result.universe);
  const noHits = result.hits.length === 0;
  const watchlistEmpty = result.universe === "watchlist" && result.scanned === 0;
  // Server menandai bila hasil ORB berasal dari sesi yang sudah selesai.
  const sessionEnded =
    result.mode === "orb" &&
    result.hits.length > 0 &&
    Boolean(result.note?.includes("Sesi hari ini sudah selesai"));

  const uniqueSetups = React.useMemo(() => {
    const seen = new Map<SetupKey, SetupTag>();
    for (const hit of result.hits) {
      if (!seen.has(hit.setup.key)) seen.set(hit.setup.key, hit.setup);
    }
    return Array.from(seen.values());
  }, [result.hits]);

  return (
    <section className="space-y-3" aria-label="Hasil pencarian">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{modeLabel}</Badge>
        <Badge tone="outline">{universeText(result.universe)}</Badge>
        {result.partial ? <Badge tone="warning">Data sebagian</Badge> : null}
      </div>

      <p className="text-[12px] leading-snug text-muted-foreground">
        {result.scanned} saham dicek · {result.fetched} data terbaca · {result.hits.length} cocok
        aturan · {fmtEtDateTime(result.asOf)}
      </p>

      {total !== null && result.scanned > 0 && result.scanned < total ? (
        <p className="text-[11.5px] leading-snug text-muted-foreground">
          Diperiksa {result.scanned} dari {total} saham (batas di bagian Lanjutan).
        </p>
      ) : null}

      {result.partial ? (
        <div className="rounded-2xl border border-warning/40 bg-warning-soft/50 px-3 py-2.5">
          <p className="text-[12px] font-semibold text-warning">Sebagian data gagal diambil</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
            {result.failed} dari {result.scanned} saham tidak terbaca, jadi bisa ada saham yang
            terlewat. Hasil di bawah tetap bisa dipakai — coba cari lagi beberapa saat lagi kalau
            ingin lebih lengkap.
          </p>
        </div>
      ) : null}

      {sessionEnded ? (
        <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          Sesi hari ini sudah selesai. Hasil di bawah berasal dari sesi terakhir yang baru ditutup,
          bukan sesi berjalan — periksa lagi besok sebelum pasar buka.
        </div>
      ) : null}

      {noHits ? (
        watchlistEmpty ? (
          <EmptyState
            icon={<ListChecks className="size-5" aria-hidden="true" />}
            title="Daftar pantau masih kosong"
            description="Tambahkan saham dulu, lalu cari lagi di daftar pantau."
            action={
              <Link
                href="/trading/inspeksi"
                className={cn(buttonVariants({ size: "sm" }), "h-10")}
              >
                <Search className="size-4" aria-hidden="true" />
                Cari & tambah saham
              </Link>
            }
          />
        ) : (
          <EmptyState
            compact
            icon={<Radar className="size-5" aria-hidden="true" />}
            title={result.mode === "orb" ? "Belum ada yang tembus" : "Belum ada yang cocok"}
            description={emptySuggestion(result)}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" size="sm" className="h-10" onClick={onRetry}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Cari ulang
                </Button>
                {result.mode === "orb" ? (
                  <Button variant="soft" size="sm" className="h-10" onClick={onUseDaily}>
                    Pakai mode Harian
                  </Button>
                ) : (
                  <>
                    {result.universe !== "mega" ? (
                      <Button variant="soft" size="sm" className="h-10" onClick={onTryMega}>
                        Coba 20 saham besar
                      </Button>
                    ) : null}
                    {result.universe !== "watchlist" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10"
                        onClick={onScanWatchlist}
                      >
                        Cari di daftar pantau
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          <SectionTitle
            title={`${result.hits.length} saham cocok aturan`}
            hint="Diurutkan dari nilai transaksi (harga × volume) terbesar. Periksa dulu sebelum menyusun rencana."
          />
          <SetupLegend tags={uniqueSetups} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {result.hits.map((hit) => (
              <ScanHitCard
                key={hit.symbol}
                hit={hit}
                added={added.has(hit.symbol)}
                saving={savingSymbol === hit.symbol}
                onAdd={onAdd}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SetupLegend({ tags }: { tags: SetupTag[] }) {
  if (!tags.length) return null;
  return (
    <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Arti nama setup
      </p>
      <ul className="mt-1.5 space-y-1">
        {tags.map((tag) => (
          <li key={tag.key} className="text-[11.5px] leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">{tag.label}</span> ={" "}
            {setupMeaning(tag.key)}.
          </li>
        ))}
      </ul>
    </div>
  );
}
