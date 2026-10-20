import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  jsonError,
  jsonOk,
  readJson,
  requireApiUser,
  validationError,
} from "@/lib/api";
import { destroySession } from "@/lib/auth";
import { deleteAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/password";

const bodySchema = z.object({
  password: z.string().min(1, "Kata sandi wajib diisi."),
  confirmation: z.literal("HAPUS", {
    error: "Ketik HAPUS untuk mengonfirmasi.",
  }),
});

/**
 * Hapus akun permanen. Wajib konfirmasi kata sandi + kata "HAPUS".
 * Seluruh transaksi, kategori, target, anggaran, pengingat, dan sesi ikut dihapus.
 */
export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const raw = await readJson(request);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  const rows = await db.select().from(users).where(eq(users.id, auth.user.id));
  const row = rows[0];
  if (!row) return jsonError("Akun tidak ditemukan.", 404);

  if (!verifyPassword(parsed.data.password, row.passwordHash)) {
    return jsonError("Kata sandi salah. Akun tidak dihapus.", 401, {
      password: "Kata sandi salah.",
    });
  }

  await deleteAccount(auth.user.id);
  await destroySession();

  return jsonOk({ ok: true });
}
