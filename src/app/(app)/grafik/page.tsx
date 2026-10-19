import { GrafikView } from "@/components/charts/grafik-view";
import { requireUser } from "@/lib/auth";
import { listAllTransactions } from "@/lib/data";
import type { RangeKey } from "@/lib/date";

export const metadata = { title: "Grafik" };

const RANGE_KEYS: RangeKey[] = ["week", "month", "year"];

/** Boleh membuka /grafik?range=week|month|year; default bulan ini. */
function parseRange(value: string | string[] | undefined): RangeKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return RANGE_KEYS.includes(candidate as RangeKey) ? (candidate as RangeKey) : "month";
}

export default async function GrafikPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const transactions = listAllTransactions(user.id);
  const { range } = await searchParams;

  return (
    <GrafikView
      transactions={transactions}
      currency={user.currency}
      initialRange={parseRange(range)}
    />
  );
}
