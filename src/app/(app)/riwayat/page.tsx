import { HistoryView } from "@/components/history/history-view";
import { requireUser } from "@/lib/auth";
import { getCategories, listAllTransactions } from "@/lib/data";
import { todayISO } from "@/lib/date";

export const metadata = { title: "Riwayat" };

export default async function RiwayatPage() {
  const user = await requireUser();

  // Semua pengambilan data dilakukan di server (src/lib/data).
  // Hasilnya DTO serializable yang aman dikirim ke client component.
  const transactions = await listAllTransactions(user.id);
  const categories = await getCategories(user.id);

  return (
    <HistoryView
      transactions={transactions}
      categories={categories}
      currency={user.currency}
      today={todayISO()}
    />
  );
}
