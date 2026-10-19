import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { deleteTransaction, getTransactionById, updateTransaction } from "@/lib/data";
import { transactionSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const transaction = getTransactionById(auth.user.id, id);
  if (!transaction) return jsonError("Transaksi tidak ditemukan.", 404);
  return jsonOk({ transaction });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await readJson(request);
  const parsed = transactionSchema.partial().safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const transaction = updateTransaction(auth.user.id, id, parsed.data);
  if (!transaction) return jsonError("Transaksi tidak ditemukan.", 404);
  return jsonOk({ transaction });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const deleted = deleteTransaction(auth.user.id, id);
  if (!deleted) return jsonError("Transaksi tidak ditemukan.", 404);
  return jsonOk({ ok: true });
}
