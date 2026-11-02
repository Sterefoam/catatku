import Link from "next/link";
import { ChevronRight, LineChart, Newspaper, Search, Star } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { MarketBadge, SectionTitle } from "@/components/trading/ui";
import { SymbolSearch } from "@/components/trading/inspector/symbol-search";
import { requireUser } from "@/lib/auth";
import { marketStatus } from "@/lib/trading/market-clock";
import { listWatchlist } from "@/lib/trading/data";
import { UNIVERSE_MEGA } from "@/lib/trading/universe";

export const maxDuration = 30;

export const metadata = { title: "Inspeksi Saham" };
export const dynamic = "force-dynamic";

const FITUR = [
  {
    icon: Search,
    title: "Cari & periksa",
    description: "Ketik kode atau nama saham, lalu buka laporannya: harga, grafik, dan angka penting.",
  },
  {
    icon: Newspaper,
    title: "Berita & laporan SEC",
    description: "Berita terbaru dan laporan kejadian penting (8-K) yang bisa menggerakkan harga.",
  },
  {
    icon: LineChart,
    title: "Lanjut ke rencana",
    description: "Setelah yakin, buat rencana kertas atau pengingat harga dengan simbol yang terisi.",
  },
] as const;

export default async function InspeksiPage() {
  const user = await requireUser();
  const [watchlist, market] = await Promise.all([
    listWatchlist(user.id).catch(() => []),
    Promise.resolve(marketStatus()),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/trading"
        eyebrow="Meja Trading"
        title="Inspeksi Saham"
        subtitle="Cari saham AS, lihat harga & grafiknya, lalu susun rencana dengan angka yang jelas."
        action={<MarketBadge market={market} />}
      />

      <Card className="animate-rise">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <SymbolSearch />
        </CardContent>
      </Card>

      <section className="space-y-2.5">
        <SectionTitle
          title="Saham populer"
          hint="20 saham besar AS pilihan kurasi — bukan rekomendasi beli."
        />
        <div className="flex flex-wrap gap-2">
          {UNIVERSE_MEGA.map((row) => (
            <Link
              key={row.symbol}
              href={`/trading/inspeksi/${row.symbol}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[12.5px] font-semibold transition-colors hover:bg-muted"
            >
              <span>{row.symbol}</span>
              <span className="text-[10.5px] font-medium text-muted-foreground">{row.sector}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionTitle
          title="Daftar pantau"
          hint={
            watchlist.length > 0
              ? `${watchlist.length} saham tersimpan`
              : "Belum ada saham tersimpan"
          }
          action={
            <Link
              href="/trading/scan"
              className="text-[12px] font-semibold text-primary hover:underline"
            >
              Cari setup
            </Link>
          }
        />
        {watchlist.length === 0 ? (
          <EmptyState
            compact
            icon={<Star className="size-5" aria-hidden="true" />}
            title="Daftar pantau masih kosong"
            description="Simpan saham dari laporan inspeksi supaya cepat dibuka lagi."
            action={
              <Link href="/trading/scan" className={buttonVariants({ variant: "soft", size: "sm" })}>
                Cari setup
              </Link>
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-border/80 bg-card">
            {watchlist.map((item) => (
              <li key={item.id} className="border-b border-border/60 last:border-b-0">
                <Link
                  href={`/trading/inspeksi/${encodeURIComponent(item.symbol)}`}
                  className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold">{item.symbol}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {item.name}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2.5">
        <SectionTitle title="Apa yang bisa kamu lakukan di sini" />
        <div className="grid gap-3 sm:grid-cols-3">
          {FITUR.map((fitur) => {
            const Icon = fitur.icon;
            return (
              <Card key={fitur.title}>
                <CardContent className="space-y-1.5 p-4">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="text-[13.5px] font-semibold">{fitur.title}</p>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    {fitur.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <p className="rounded-3xl border border-border/70 bg-card/60 px-4 py-3.5 text-[11.5px] leading-relaxed text-muted-foreground">
        Meja Trading untuk latihan (uang kertas). Data harga, berita, dan fundamental dari Yahoo
        Finance & SEC EDGAR (gratis, bisa tertunda). Bukan saran finansial.
      </p>
    </div>
  );
}
