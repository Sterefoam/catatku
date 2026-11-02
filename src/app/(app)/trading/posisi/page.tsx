import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { OrdersBoard } from "@/components/trading/desk/orders-board";
import { requireUser } from "@/lib/auth";
import { marketStatus } from "@/lib/trading/market-clock";
import { getTradingSettings, getTradingStats, listOrders } from "@/lib/trading/data";
import { buttonVariants } from "@/components/ui/button";

export const maxDuration = 30;

export const metadata = { title: "Posisi & Jurnal" };
export const dynamic = "force-dynamic";

export default async function PosisiPage() {
  const user = await requireUser();
  const settings = await getTradingSettings(user.id);
  const [orders, stats] = await Promise.all([
    listOrders(user.id, 100),
    getTradingStats(user.id, settings),
  ]);
  const market = marketStatus();

  return (
    <div>
      <PageHeader
        eyebrow="Meja Trading"
        backHref="/trading"
        title="Posisi & Jurnal"
        subtitle="Order latihan yang sedang berjalan dan catatan hasilnya. Isi order saat harga masuk tersentuh, tutup saat batas rugi/target kena atau jam keluar."
        action={
          <Link href="/trading/rencana" className={buttonVariants({ size: "sm" })}>Rencana baru</Link>
        }
      />
      <OrdersBoard orders={orders} stats={stats} settings={settings} market={market} />
    </div>
  );
}
