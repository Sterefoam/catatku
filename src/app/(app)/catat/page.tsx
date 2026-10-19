import { CatatLauncher } from "@/components/transactions/catat-launcher";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Catat transaksi" };

export default async function CatatPage() {
  await requireUser();

  return (
    <div>
      <PageHeader
        backHref="/"
        eyebrow="Cepat"
        title="Catat transaksi"
        subtitle="Isi nominal dan kategori, lalu simpan."
      />
      <CatatLauncher />
    </div>
  );
}
