import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Bell, ClipboardList, Info, Search, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MarketBadge, PriceChange, SectionTitle } from "@/components/trading/ui";
import { DailyChart, IntradayChart } from "@/components/trading/inspector/charts";
import { FundamentalsTable } from "@/components/trading/inspector/fundamentals-table";
import { NewsPanel } from "@/components/trading/inspector/news-panel";
import { buildRiskNotes } from "@/components/trading/inspector/risk-notes";
import { SetupCard } from "@/components/trading/inspector/setup-card";
import { TechnicalsCard } from "@/components/trading/inspector/technicals-card";
import { buildVerdict } from "@/components/trading/inspector/verdict";
import { WatchlistButton } from "@/components/trading/inspector/watchlist-button";
import { requireUser } from "@/lib/auth";
import { marketStatus } from "@/lib/trading/market-clock";
import { listWatchlist } from "@/lib/trading/data";
import { fmtEtDateTime, fmtPrice } from "@/lib/trading/format";
import { getTradingNews } from "@/lib/trading/news";
import { getFundamentals } from "@/lib/trading/sec";
import { analyze } from "@/lib/trading/technicals";
import { fetchChart, fetchQuote } from "@/lib/trading/yahoo";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 60;

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;
const NEWS_HOURS = 168;

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const clean = (symbol ?? "").trim().toUpperCase().slice(0, 10);
  return { title: clean ? `Inspeksi ${clean}` : "Inspeksi Saham" };
}

function SymbolMessage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <PageHeader backHref="/trading/inspeksi" eyebrow="Meja Trading" title="Inspeksi Saham" />
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        action={
          <Link href="/trading/inspeksi" className={buttonVariants({ variant: "primary" })}>
            Cari saham lain
          </Link>
        }
      />
    </div>
  );
}

export default async function InspectSymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: rawSymbol } = await params;
  let decoded = rawSymbol ?? "";
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Biarkan apa adanya; validasi regex menentukan.
  }
  const symbol = decoded.trim().toUpperCase();

  if (!SYMBOL_RE.test(symbol)) {
    return (
      <SymbolMessage
        title={`Simbol "${symbol || "—"}" tidak valid`}
        description="Gunakan kode saham AS 1–10 karakter, mis. TSLA, NVDA, atau BRK-B."
        icon={<Search className="size-6" aria-hidden="true" />}
      />
    );
  }

  const user = await requireUser();
  // Ambil semua data sekaligus (langsung lewat lib, bukan HTTP ke route sendiri).
  const [quote, daily, intraday, watchlist, news, secResult] = await Promise.all([
    fetchQuote(symbol).catch(() => null),
    fetchChart(symbol, "3mo", "1d").catch(() => null),
    fetchChart(symbol, "1d", "5m").catch(() => null),
    listWatchlist(user.id).catch(() => []),
    getTradingNews([symbol], NEWS_HOURS).catch(() => []),
    getFundamentals(symbol).catch(() => null),
  ]);
  const market = marketStatus();

  if (!quote) {
    return (
      <SymbolMessage
        title={`Simbol ${symbol} tidak dikenal`}
        description="Yahoo Finance tidak punya data untuk kode ini. Periksa ejaannya (contoh: TSLA, NVDA, BRK-B), atau coba lagi sebentar."
        icon={<Search className="size-6" aria-hidden="true" />}
      />
    );
  }

  if (!daily || daily.bars.length < 2) {
    return (
      <SymbolMessage
        title={`Grafik ${symbol} belum tersedia`}
        description="Harganya ada, tetapi grafik harian belum bisa diambil dari sumber gratis. Coba lagi sebentar atau periksa saham lain."
        icon={<TriangleAlert className="size-6" aria-hidden="true" />}
      />
    );
  }

  let analysis: ReturnType<typeof analyze>;
  try {
    analysis = analyze({ symbol, daily, intraday, quote });
  } catch {
    return (
      <SymbolMessage
        title={`Data ${symbol} belum bisa diolah`}
        description="Angka yang diterima belum lengkap. Coba muat ulang halaman ini beberapa saat lagi."
        icon={<TriangleAlert className="size-6" aria-hidden="true" />}
      />
    );
  }

  const technicals = analysis.technicals;
  const riskNotes = buildRiskNotes(quote, technicals);
  const verdict = buildVerdict({ quote, technicals, setups: analysis.setups, market });
  const inWatchlist = watchlist.some((item) => item.symbol === symbol);
  const planHref = `/trading/rencana?symbol=${encodeURIComponent(symbol)}`;
  const alertHref = `/trading/alert?symbol=${encodeURIComponent(symbol)}`;

  return (
    <div className="space-y-5">
      <PageHeader
        backHref="/trading/inspeksi"
        eyebrow="Meja Trading"
        title={symbol}
        subtitle={quote.name}
        action={<MarketBadge market={market} />}
      />

      {/* Harga + kesimpulan + tombol utama */}
      <Card className="animate-rise">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[22px] font-extrabold tracking-tight">{symbol}</h2>
                <Badge tone="outline">USD</Badge>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">
                {quote.name}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="money text-[30px] font-extrabold leading-none tracking-tight sm:text-[34px]">
                {fmtPrice(quote.price)}
              </p>
              <div className="mt-1 flex justify-end">
                <PriceChange change={quote.change} changePct={quote.changePct} showAmount />
              </div>
            </div>
          </div>

          <p className="rounded-2xl bg-primary-soft/60 px-3.5 py-2.5 text-[13px] font-medium leading-snug text-primary">
            {verdict}
          </p>

          <p className="text-[11px] text-muted-foreground">
            Harga terakhir {fmtEtDateTime(quote.asOf)} · data gratis, bisa tertunda. Bukan saran
            finansial.
          </p>

          <div className="grid gap-2 sm:grid-cols-3">
            <Link href={planHref} className={buttonVariants({ variant: "primary" })}>
              <ClipboardList className="size-4" aria-hidden="true" />
              Buat rencana
            </Link>
            <WatchlistButton symbol={symbol} name={quote.name} inWatchlist={inWatchlist} />
            <Link href={alertHref} className={buttonVariants({ variant: "outline" })}>
              <Bell className="size-4" aria-hidden="true" />
              Buat pengingat harga
            </Link>
          </div>

          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Buat rencana membuka form dengan simbol {symbol} sudah terisi: harga masuk, batas rugi
            (stop), target untung, dan jumlah lembar. Semua latihan (uang kertas). Mau cari kandidat
            lain?{" "}
            <Link href="/trading/scan" className="font-semibold text-primary hover:underline">
              Cari setup
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      {/* Grafik */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <SectionTitle
            title="Grafik"
            hint="Atas: gerak harga 5 menit sesi terakhir. Bawah: tren 3 bulan."
          />
          <div className="space-y-2">
            <h3 className="text-[12.5px] font-semibold text-muted-foreground">5 menit</h3>
            <IntradayChart
              series={intraday}
              openingRange={technicals.openingRange}
              prevClose={quote.prevClose}
              market={market}
            />
          </div>
          <div className="h-px bg-border/70" aria-hidden="true" />
          <div className="space-y-2">
            <h3 className="text-[12.5px] font-semibold text-muted-foreground">3 bulan</h3>
            <DailyChart series={daily} high20={technicals.high20} low20={technicals.low20} />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Garis putus-putus = rentang awal 15 menit pertama & harga tutup sebelumnya.
          </p>
        </CardContent>
      </Card>

      <SetupCard setups={analysis.setups} />

      {/* Berita & 8-K */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <NewsPanel symbol={symbol} items={news} hours={NEWS_HOURS} />
        </CardContent>
      </Card>

      <TechnicalsCard technicals={technicals} />

      <FundamentalsTable fundamentals={secResult?.fundamentals ?? null} />

      {/* Catatan risiko */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <SectionTitle
            title="Catatan risiko"
            hint="Dibuat otomatis dari harga & teknikal. Bukan saran finansial."
          />
          <ul className="space-y-2">
            {riskNotes.map((note) => (
              <li key={note} className="flex items-start gap-2 text-[12.5px] leading-snug">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <span className="text-muted-foreground">{note}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="rounded-3xl border border-border/70 bg-card/60 px-4 py-3.5">
        <p className="flex items-center gap-2 text-[12.5px] font-semibold">
          <Info className="size-4 text-primary" aria-hidden="true" />
          Latihan (uang kertas), bukan uang sungguhan
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
          Meja Trading Catatku hanya untuk belajar menyusun rencana. Data harga, berita, dan
          fundamental dari Yahoo Finance & SEC EDGAR (gratis, bisa tertunda dan tidak selalu lengkap).
          Bukan saran finansial.
        </p>
      </div>
    </div>
  );
}
