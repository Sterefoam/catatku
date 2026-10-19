import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { ignorePendingTransaction } from "@/lib/inbox";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const ignored = await ignorePendingTransaction(auth.user.id, id);
  if (!ignored) {
    return jsonError("Transaksi tertunda tidak ditemukan atau sudah diproses.", 404);
  }
  return jsonOk({ ok: true });
}
