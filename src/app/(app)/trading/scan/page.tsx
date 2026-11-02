import { PageHeader } from "@/components/ui/page-header";
import { Disclosure } from "@/components/trading/ui";
import { ScanPanel } from "@/components/trading/scan/scan-panel";
import { requireUser } from "@/lib/auth";
import { getTradingSettings } from "@/lib/trading/data";
import { marketStatus } from "@/lib/trading/market-clock";

export const metadata = { title: "Cari Setup" };
export const dynamic = "force-dynamic";

const HOW_IT_WORKS = [
  "Pilih mode: Harian untuk memakai harga penutupan, atau Saat pasar buka untuk saham yang menembus rentang awal 15 menit.",
  "Saham dicek satu per satu dari daftar pilihanmu (maksimal 100 saham), bukan seluruh pasar.",
  "Hasil berarti “cocok dengan aturan”, bukan ajakan beli. Periksa dulu sebelum menyusun rencana.",
];

export default async function TradingScanPage() {
  const user = await requireUser();
  const settings = await getTradingSettings(user.id);
  const market = marketStatus();

  return (
    <div>
      <PageHeader
        eyebrow="Meja Trading"
        backHref="/trading"
        title="Cari Setup"
        subtitle="Cari saham yang sedang cocok dengan aturan. Hasilnya bahan periksa, bukan ajakan beli."
      />
      <div className="space-y-5">
        <ScanPanel initialUniverse={settings.universe} market={market} />

        <Disclosure
          title="Cara kerja & catatan data"
          hint="Kenapa hasilnya bisa kosong, dan dari mana datanya"
        >
          <ol className="space-y-2.5">
            {HOW_IT_WORKS.map((point, index) => (
              <li key={point} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-[11px] font-bold text-primary">
                  {index + 1}
                </span>
                <span className="text-[12.5px] leading-snug">{point}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 rounded-2xl bg-surface/50 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Harga & volume dari Yahoo Finance (gratis, bisa tertunda 1–15 menit). Mode “Saat pasar
            buka” baru berisi hasil setelah rentang awal 15 menit selesai (09.50 ET). Semua order di
            Meja Trading hanya kertas (latihan tanpa uang sungguhan) dan bukan saran finansial.
          </p>
        </Disclosure>

        <p className="px-1 pb-2 text-[11px] leading-relaxed text-muted-foreground">
          Tips: mulai dari mode Harian kalau belum tahu mau cari apa. Setelah ketemu kandidat, tekan
          “Buat rencana” supaya batas rugi dan target dihitung dengan batas risiko kamu.
        </p>
      </div>
    </div>
  );
}
