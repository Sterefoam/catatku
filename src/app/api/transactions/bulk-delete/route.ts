import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { deleteTransactionsBulk } from "@/lib/data";

const bodySchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "Pilih minimal satu transaksi.")
    .max(500, "Maksimal 500 transaksi sekali hapus."),
});

/** Hapus banyak transaksi sekaligus (dipakai mode pilih di Riwayat). */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const raw = await readJson(request);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  const deleted = await deleteTransactionsBulk(auth.user.id, parsed.data.ids);
  if (deleted === 0) {
    return jsonError("Tidak ada transaksi milik akun ini yang terhapus.", 404);
  }

  return jsonOk({ deleted });
}
