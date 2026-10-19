import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { InboxError, confirmPendingTransaction } from "@/lib/inbox";

const bodySchema = z.object({
  categoryId: z.string().min(1, "Kategori wajib dipilih."),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const raw = await readJson(request);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const transaction = await confirmPendingTransaction(
      auth.user.id,
      id,
      parsed.data.categoryId,
    );
    return jsonOk({ transaction });
  } catch (error) {
    if (error instanceof InboxError) {
      return jsonError(error.message, error.status);
    }
    console.error("[inbox-confirm]", error);
    return jsonError("Transaksi gagal dikonfirmasi. Coba lagi.", 500);
  }
}
