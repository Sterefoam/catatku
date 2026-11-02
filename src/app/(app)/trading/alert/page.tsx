import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { AlertCenter } from "@/components/trading/desk/alert-center";
import { requireUser } from "@/lib/auth";
import { marketStatus } from "@/lib/trading/market-clock";
import { getTradingSettings, listAlerts, listPlans } from "@/lib/trading/data";
import type { AlertKind } from "@/lib/trading/types";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Pengingat Harga" };
export const dynamic = "force-dynamic";

const ALERT_KINDS: AlertKind[] = ["above", "below", "stop", "target", "pct", "bell", "flat-by"];

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AlertPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const rawSymbol = firstParam(params.symbol).trim().toUpperCase();
  const initialSymbol = /^[A-Z][A-Z0-9.\-]{0,9}$/.test(rawSymbol) ? rawSymbol : "";
  const rawKind = firstParam(params.kind).trim();
  const initialKind = ALERT_KINDS.includes(rawKind as AlertKind)
    ? (rawKind as AlertKind)
    : null;

  const settings = await getTradingSettings(user.id);
  const [alerts, plans] = await Promise.all([
    listAlerts(user.id),
    listPlans(user.id, ["active", "triggered"]),
  ]);
  const market = marketStatus();

  return (
    <div>
      <PageHeader
        eyebrow="Meja Trading"
        backHref="/trading"
        title="Pengingat Harga"
        subtitle="Bunyi saat harga menyentuh batas rugi, target untung, bel pembukaan, atau jam keluar. Pengecekan tiap 30 detik selama halaman ini terbuka."
        action={
          <Link href="/trading/posisi" className={buttonVariants({ size: "sm", variant: "outline" })}>
              Posisi &amp; jurnal
            </Link>
        }
      />
      <AlertCenter
        alerts={alerts}
        plans={plans}
        settings={settings}
        market={market}
        initialSymbol={initialSymbol}
        initialKind={initialKind}
      />
    </div>
  );
}
