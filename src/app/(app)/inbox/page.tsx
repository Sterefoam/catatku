import { InboxView } from "@/components/inbox/inbox-view";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { todayISO } from "@/lib/date";
import { listPendingTransactions } from "@/lib/inbox";

export const metadata = { title: "Kotak Masuk" };

export default async function InboxPage() {
  const user = await requireUser();

  // Data diambil langsung di server lewat @/lib/inbox (bukan fetch API),
  // lalu dikirim sebagai props serializable ke InboxView.
  const [items, categories] = await Promise.all([
    listPendingTransactions(user.id),
    getCategories(user.id),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Otomatis"
        title="Kotak Masuk"
        subtitle="Transaksi dari email BCA & impor mutasi — konfirmasi sebelum dicatat."
        backHref="/"
        action={
          items.length > 0 ? <Badge tone="primary">{items.length} menunggu</Badge> : undefined
        }
      />
      <InboxView
        items={items}
        categories={categories}
        currency={user.currency}
        today={todayISO()}
      />
    </div>
  );
}
