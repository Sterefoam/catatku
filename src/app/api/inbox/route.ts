import { jsonOk, requireApiUser } from "@/lib/api";
import { listPendingTransactions } from "@/lib/inbox";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const items = await listPendingTransactions(auth.user.id);
  return jsonOk({ items, count: items.length });
}
