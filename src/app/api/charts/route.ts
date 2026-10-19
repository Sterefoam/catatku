import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { buildCharts } from "@/lib/analytics";
import { listAllTransactions } from "@/lib/data";
import { todayISO, type RangeKey } from "@/lib/date";

const RANGES: RangeKey[] = ["week", "month", "year"];

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const params = new URL(request.url).searchParams;
  const raw = params.get("range") ?? "month";
  if (!RANGES.includes(raw as RangeKey)) {
    return jsonError("Rentang waktu tidak valid.", 422);
  }

  const transactions = await listAllTransactions(auth.user.id);
  const charts = buildCharts(transactions, raw as RangeKey, todayISO());
  return jsonOk(charts);
}
