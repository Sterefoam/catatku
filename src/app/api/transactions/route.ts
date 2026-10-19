import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { createTransaction, listTransactions } from "@/lib/data";
import { transactionSchema } from "@/lib/validation";
import type { TxType } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const params = new URL(request.url).searchParams;
  const typeParam = params.get("type");
  const type = typeParam === "income" || typeParam === "expense" ? (typeParam as TxType) : undefined;

  const items = listTransactions(auth.user.id, {
    limit: Number(params.get("limit") ?? 300),
    offset: Number(params.get("offset") ?? 0),
    type,
    categoryId: params.get("categoryId") ?? undefined,
    q: params.get("q") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });

  return jsonOk({ items });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = transactionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const transaction = createTransaction(auth.user.id, {
    type: parsed.data.type,
    amount: parsed.data.amount,
    categoryId: parsed.data.categoryId,
    date: parsed.data.date,
    note: parsed.data.note ?? null,
  });

  return jsonOk({ transaction }, 201);
}

export async function DELETE() {
  return jsonError("Gunakan /api/transactions/[id] untuk menghapus.", 405);
}
