import { PageHeader } from "@/components/ui/page-header";
import { RiskSettingsForm } from "@/components/trading/desk/risk-settings-form";
import { requireUser } from "@/lib/auth";
import { getTradingSettings } from "@/lib/trading/data";
import { flatByFor, marketStatus } from "@/lib/trading/market-clock";

export const metadata = { title: "Pengaturan Trading" };
export const dynamic = "force-dynamic";

export default async function PengaturanTradingPage() {
  const user = await requireUser();
  const settings = await getTradingSettings(user.id);
  const market = marketStatus();
  const flatBy = flatByFor(market.sessionDate, settings.flatBy);
  const marketChanged = flatBy !== settings.flatBy;
  // Teks detail bursa sudah memuat nama keadaan ("Pra-pasar sampai ...").
  // Jangan ulang label di depannya supaya tidak dobel.
  const marketLine = market.detail.startsWith(market.label)
    ? market.detail
    : `${market.label}: ${market.detail}`;

  return (
    <div>
      <PageHeader
        eyebrow="Meja Trading"
        backHref="/trading"
        title="Pengaturan Trading"
        subtitle="Atur modal latihan, batas rugi, dan jam sesi. Nilai ini dipakai saat menghitung rencana dan menolak order yang melewati batas."
      />

      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-border/80 bg-card px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
          <span>{marketLine}</span>
          <span aria-hidden="true">·</span>
          <span>
            Jam keluar efektif hari ini {flatBy} ET
            {marketChanged
              ? ` (disesuaikan dari ${settings.flatBy} karena bursa tutup dini)`
              : ""}
            .
          </span>
        </div>

        <RiskSettingsForm settings={settings} />
      </div>
    </div>
  );
}
