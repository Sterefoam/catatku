import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { PlanBuilder } from "@/components/trading/desk/plan-builder";
import { PlanList } from "@/components/trading/desk/plan-list";
import { requireUser } from "@/lib/auth";
import { marketStatus } from "@/lib/trading/market-clock";
import { getTradingSettings, listPlans } from "@/lib/trading/data";
import type { SetupType } from "@/lib/trading/types";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Buat Rencana" };
export const dynamic = "force-dynamic";

const SETUP_VALUES: SetupType[] = ["orb", "level", "breakout20", "flag"];

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function RencanaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const rawSymbol = firstParam(params.symbol).trim().toUpperCase();
  const initialSymbol = /^[A-Z][A-Z0-9.\-]{0,9}$/.test(rawSymbol) ? rawSymbol : "";
  const rawSetup = firstParam(params.setup).trim();
  const initialSetupType = SETUP_VALUES.includes(rawSetup as SetupType)
    ? (rawSetup as SetupType)
    : "orb";
  const rawPlanId = firstParam(params.plan).trim().slice(0, 64);

  const settings = await getTradingSettings(user.id);
  const [allPlans, market] = await Promise.all([
    listPlans(user.id),
    Promise.resolve(marketStatus()),
  ]);
  const plans = allPlans.filter(
    (plan) => plan.status === "active" || plan.status === "triggered",
  );
  const existingPlan = rawPlanId
    ? (allPlans.find((plan) => plan.id === rawPlanId) ?? null)
    : null;

  return (
    <div>
      <PageHeader
        eyebrow="Meja Trading"
        backHref="/trading"
        title={existingPlan ? "Salin rencana" : "Buat Rencana"}
        subtitle={
          existingPlan
            ? `Isian disalin dari rencana aktif ${existingPlan.symbol}. Simpan akan membuat rencana baru; rencana lama tidak berubah.`
            : "Tentukan harga masuk, batas rugi, dan target untung sebelum masuk. Semua latihan (uang kertas) — tanpa uang sungguhan."
        }
        action={
          <Link href="/trading/posisi" className={buttonVariants({ size: "sm", variant: "outline" })}>
              Posisi &amp; jurnal
            </Link>
        }
      />

      <div className="space-y-6">
        <PlanBuilder
          initialSymbol={initialSymbol}
          initialSetupType={initialSetupType}
          settings={settings}
          market={market}
          existingPlan={existingPlan}
        />
        <PlanList plans={plans} />
      </div>
    </div>
  );
}
