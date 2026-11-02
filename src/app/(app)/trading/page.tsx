import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bell,
  ClipboardList,
  LineChart,
  Search,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { MarketBadge, PriceChange, SectionTitle, StatTile } from "@/components/trading/ui";
import { QuickSymbolSearch } from "@/components/trading/dashboard/quick-symbol-search";
import { requireUser } from "@/lib/auth";
import { flatByFor, marketStatus } from "@/lib/trading/market-clock";
import {
  getTradingSettings,
  getTradingStats,
  listAlerts,
  listOrders,
  listPlans,
  listWatchlist,
} from "@/lib/trading/data";
import { fetchQuotes } from "@/lib/trading/yahoo";
import { fmtEtDateTime, fmtPrice, fmtQty } from "@/lib/trading/format";
import type { OrderDTO, SetupType } from "@/lib/trading/types";
import { cn } from "@/lib/utils";

export const maxDuration = 30;

export const metadata = { title: "Meja Trading" };

const SETUP_TYPE_LABELS: Record<SetupType, string> = {
  orb: "Tembus rentang awal",
  level: "Level sendiri",
  breakout20: "Tembus tertinggi 20 hari",
  flag: "Bendera banteng",
};

const ORDER_LABELS: Record<OrderDTO["status"], string> = {
  pending: "Menunggu",
  filled: "Terbuka",
  closed: "Selesai",
  cancelled: "Dibatalkan",
};

function HeroStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">{label}</p>
      <p className="money mt-0.5 text-[15px] font-bold leading-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[10.5px] text-white/60">{hint}</p> : null}
    </div>
  );
}

export default async function TradingDeskPage() {
  const user = await requireUser();
  const [settings, watchlist, plans, orders, alerts] = await Promise.all([
    getTradingSettings(user.id),
    listWatchlist(user.id),
    listPlans(user.id, ["active", "triggered"]),
    listOrders(user.id, 12),
    listAlerts(user.id),
  ]);

  const [stats, market] = await Promise.all([
    getTradingStats(user.id, settings),
    Promise.resolve(marketStatus()),
  ]);

  const flatBy = flatByFor(market.sessionDate, settings.flatBy);
  const activePlan = plans[0] ?? null;
  const openOrders = orders
    .filter((order) => order.status === "pending" || order.status === "filled")
    .slice(0, 4);
  const recentClosed = orders.filter((order) => order.status === "closed").slice(0, 3);
  const activeAlerts = alerts.filter((alert) => alert.isActive);

  const symbols = Array.from(
    new Set(
      [
        ...watchlist.slice(0, 8).map((item) => item.symbol),
        activePlan?.symbol,
        ...openOrders.map((order) => order.symbol),
      ].filter((symbol): symbol is string => Boolean(symbol)),
    ),
  );
  const quotes = symbols.length
    ? await fetchQuotes(symbols).catch(() => new Map())
    : new Map();

  const riskPercent =
    settings.dailyLossLimit > 0
      ? Math.min(100, Math.round((stats.riskToday / settings.dailyLossLimit) * 100))
      : 0;
  const chips = (watchlist.length ? watchlist.slice(0, 5) : []).map((item) => item.symbol);

  return (
    <div>
      <PageHeader
        eyebrow="Meja Trading"
        title="Meja Trading"
        subtitle="Cari saham, susun rencana, dan pantau latihan tanpa uang sungguhan."
        action={<MarketBadge market={market} />}
      />

      <div className="space-y-5">
        {/* 1. Hal pertama & paling penting: cari saham. */}
        <section className="space-y-2.5" aria-labelledby="cari-saham">
          <div>
            <h2 id="cari-saham" className="text-[16px] font-bold tracking-tight">
              Cari saham
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              Ketik kode saham AS (mis. TSLA) untuk melihat laporan lengkapnya.
            </p>
          </div>
          <QuickSymbolSearch placeholder="Cari saham, mis. TSLA, NVDA, AAPL" />
          <div className="flex flex-wrap gap-1.5">
            {chips.map((symbol) => (
              <Link
                key={symbol}
                href={`/trading/inspeksi/${symbol}`}
                className="inline-flex h-10 items-center rounded-full border border-border bg-card px-3.5 text-[12px] font-semibold transition-colors hover:bg-muted"
              >
                {symbol}
              </Link>
            ))}
            <Link
              href="/trading/inspeksi"
              className="inline-flex h-10 items-center gap-1 rounded-full bg-primary-soft px-3.5 text-[12px] font-semibold text-primary"
            >
              <Search className="size-3.5" />
              Semua saham
            </Link>
          </div>
        </section>

        {/* 2. Status sesi & batas risiko hari ini. */}
        <section className="hero-card relative overflow-hidden rounded-[1.8rem] p-5 text-white sm:p-6">
          <span className="pointer-events-none absolute -right-12 -top-20 size-52 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute -bottom-28 -left-14 size-64 rounded-full bg-white/[0.06]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/60">
                  Sesi New York
                </p>
                <p className="mt-1 text-[19px] font-bold leading-tight">{market.label}</p>
                <p className="mt-1 max-w-[22rem] text-[12px] leading-relaxed text-white/70">
                  {market.detail}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-semibold">
                {market.sessionDate}
              </span>
            </div>

            {market.nextEvent ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11.5px] font-medium text-white/85">
                <Activity className="size-3.5" aria-hidden="true" />
                {market.nextEvent.label} · {fmtEtDateTime(market.nextEvent.at)}
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <HeroStat label="Modal latihan" value={fmtPrice(stats.paperEquity)} />
              <HeroStat
                label="Risiko hari ini"
                value={fmtPrice(stats.riskToday)}
                hint={`batas ${fmtPrice(settings.dailyLossLimit)}`}
              />
              <HeroStat
                label="Trade hari ini"
                value={`${stats.tradesToday}/${settings.maxTradesPerDay}`}
                hint="trade yang sudah diisi"
              />
              <HeroStat label="Jam keluar" value={`${flatBy} ET`} hint="semua posisi ditutup" />
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[10.5px] text-white/60">
                <span>Pemakaian batas rugi harian</span>
                <span>{riskPercent}%</span>
              </div>
              <Progress
                value={riskPercent}
                tone={riskPercent >= 80 ? "danger" : "primary"}
                className="mt-1.5 h-1.5 bg-white/20"
              />
            </div>
          </div>
        </section>

        {/* 3. Rencana & posisi: yang sedang berjalan. */}
        <section className="space-y-3">
          <SectionTitle
            title="Rencana & posisi"
            hint="Semua order hanya dicatat di Catatku."
            action={
              <Link href="/trading/rencana" className={buttonVariants({ size: "sm", variant: "outline" })}>
                  Buat rencana
                </Link>
            }
          />

          {activePlan ? (
            <Card className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[16px] font-bold">{activePlan.symbol}</h3>
                    <Badge tone={activePlan.status === "triggered" ? "success" : "primary"}>
                      {activePlan.status === "triggered" ? "Sudah masuk" : "Menunggu harga masuk"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">
                    {SETUP_TYPE_LABELS[activePlan.setupType]} · keluar paling lambat{" "}
                    {activePlan.flatBy} ET
                  </p>
                </div>
                <ShieldCheck
                  className={cn("size-5 shrink-0", activePlan.ok ? "text-success" : "text-danger")}
                  aria-hidden="true"
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Harga masuk" value={fmtPrice(activePlan.entry)} />
                <StatTile label="Batas rugi" value={fmtPrice(activePlan.stop)} tone="danger" />
                <StatTile label="Target untung" value={fmtPrice(activePlan.target)} tone="success" />
                <StatTile
                  label="Jumlah lembar"
                  value={`${fmtQty(activePlan.size.qty)}`}
                  hint={`untung ${fmtPrice(activePlan.target - activePlan.entry)} / lembar`}
                />
              </div>

              <p className="mt-3 rounded-2xl bg-warning-soft/60 px-3.5 py-2.5 text-[12px] leading-relaxed text-warning">
                Kalau harga turun sampai batas rugi, kerugianmu sekitar{" "}
                <strong>{fmtPrice(activePlan.size.riskAmount)}</strong>.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/trading/posisi" className={buttonVariants({ size: "sm", variant: "soft" })}>
                    Lihat order latihan
                  </Link>
                <Link href={`/trading/rencana?plan=${activePlan.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                    Buka / salin rencana
                  </Link>
              </div>
            </Card>
          ) : (
            <Card className="flex items-center gap-3 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <ClipboardList className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold">Belum ada rencana aktif</p>
                <p className="text-[11.5px] leading-snug text-muted-foreground">
                  Periksa satu saham dulu, lalu tentukan harga masuk, batas rugi, dan target.
                </p>
              </div>
              <Link href="/trading/inspeksi" className={buttonVariants({ size: "sm", variant: "outline" })}>
                  Periksa saham
                </Link>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile label="Posisi terbuka" value={String(stats.openPositions)} />
            <StatTile label="Order menunggu" value={String(stats.pendingOrders)} />
            <StatTile
              label="Uang berisiko"
              value={fmtPrice(stats.openRisk)}
              hint="kalau semua kena batas rugi"
            />
            <StatTile
              label="Hasil hari ini"
              value={fmtPrice(stats.realizedPnlToday)}
              tone={
                stats.realizedPnlToday > 0
                  ? "success"
                  : stats.realizedPnlToday < 0
                    ? "danger"
                    : "default"
              }
            />
          </div>

          {openOrders.length ? (
            <Card className="divide-y divide-border/70 overflow-hidden">
              {openOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-[10.5px] font-bold">
                    {order.symbol.slice(0, 4)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">
                      {order.symbol} · {fmtQty(order.qty)} lembar
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Masuk {fmtPrice(order.entry)} · rugi {fmtPrice(order.stop)} · untung{" "}
                      {fmtPrice(order.target)}
                    </p>
                  </div>
                  <Badge tone={order.status === "filled" ? "success" : "warning"}>
                    {ORDER_LABELS[order.status]}
                  </Badge>
                </div>
              ))}
            </Card>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-[12px] text-muted-foreground">
              Tidak ada order latihan yang berjalan. Buat dari halaman Rencana setelah rencana
              disimpan.
            </p>
          )}

          {recentClosed.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-semibold text-muted-foreground">
                Sudah selesai:
              </span>
              {recentClosed.map((order) => (
                <span
                  key={order.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11.5px]"
                >
                  {order.symbol}
                  <span
                    className={cn(
                      "money font-semibold",
                      (order.pnl ?? 0) >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {fmtPrice(order.pnl ?? 0)}
                  </span>
                </span>
              ))}
              <Link href="/trading/posisi" className="inline-flex min-h-10 items-center text-[11.5px] font-semibold text-primary">
                Lihat jurnal
              </Link>
            </div>
          ) : null}
        </section>

        {/* 4. Daftar pantau. */}
        <section className="space-y-3">
          <SectionTitle
            title="Daftar pantau"
            hint={
              watchlist.length
                ? `${watchlist.length} saham · harga bisa tertunda beberapa menit`
                : "Belum ada saham yang dipantau."
            }
            action={
              <Link href="/trading/scan" className={buttonVariants({ size: "sm", variant: "soft" })}>
                  Cari setup
                  <ArrowRight className="size-3.5" />
                </Link>
            }
          />

          {watchlist.length ? (
            <Card className="divide-y divide-border/70 overflow-hidden">
              {watchlist.slice(0, 8).map((item) => {
                const quote = quotes.get(item.symbol);
                return (
                  <Link
                    key={item.id}
                    href={`/trading/inspeksi/${item.symbol}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-[10.5px] font-bold text-primary">
                      {item.symbol.slice(0, 4)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="text-[13.5px] font-bold">{item.symbol}</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {item.name}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="money text-[13px] font-semibold">
                          {quote ? fmtPrice(quote.price) : "—"}
                        </span>
                        {quote ? <PriceChange changePct={quote.changePct} /> : null}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                );
              })}
            </Card>
          ) : (
            <EmptyState
              icon={<Search className="size-6" aria-hidden="true" />}
              title="Daftar pantau masih kosong"
              description="Cari saham di kotak atas, atau pakai Cari Setup untuk melihat saham yang sedang cocok dengan aturan."
              action={
                <Link href="/trading/scan" className={buttonVariants()}>Cari setup</Link>
              }
            />
          )}
        </section>

        {/* 5. Pengingat harga. */}
        <section className="space-y-3">
          <SectionTitle
            title="Pengingat harga"
            hint={
              activeAlerts.length
                ? `${activeAlerts.length} pengingat aktif · dicek saat halaman Pengingat terbuka`
                : "Belum ada pengingat aktif."
            }
            action={
              <Link href="/trading/alert" className={buttonVariants({ size: "sm", variant: "outline" })}>
                  Kelola
                </Link>
            }
          />

          {activeAlerts.length ? (
            <Card className="divide-y divide-border/70 overflow-hidden">
              {activeAlerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Bell className="size-4 shrink-0 text-warning" aria-hidden="true" />
                  <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{alert.label}</p>
                  <Badge tone="neutral">{alert.symbol}</Badge>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="flex items-center gap-3 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-warning-soft text-warning">
                <Bell className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold">Pasang pengingat dari rencana aktif</p>
                <p className="text-[11.5px] leading-snug text-muted-foreground">
                  Tiga sekaligus: batas rugi, target untung, dan jam keluar.
                </p>
              </div>
              <Link href="/trading/alert" className={buttonVariants({ size: "sm" })}>Buat</Link>
            </Card>
          )}
        </section>

        {/* 6. Alat lain (kecil). */}
        <section className="space-y-2">
          <SectionTitle title="Alat lain" hint="Dipakai sesekali, tidak perlu tiap hari." />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { href: "/trading/scan", label: "Cari setup", icon: LineChart },
              { href: "/trading/posisi", label: "Posisi & jurnal", icon: Wallet },
              { href: "/trading/pengaturan", label: "Atur batas risiko", icon: Settings },
              { href: "/trading/alert", label: "Semua pengingat", icon: Bell },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-3 py-2.5 text-[12px] font-semibold transition-colors hover:bg-muted"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>

        <Card className="space-y-1.5 bg-muted/40 p-4">
          <p className="text-[12px] font-semibold">Latihan, bukan saran finansial</p>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Semua order di sini hanya catatan latihan (uang kertas). Harga, berita, dan data
            fundamental dari Yahoo Finance & SEC EDGAR bisa tertunda atau tidak lengkap. Sebagian
            besar pemula yang day trading kehilangan uang.
          </p>
        </Card>
      </div>
    </div>
  );
}
