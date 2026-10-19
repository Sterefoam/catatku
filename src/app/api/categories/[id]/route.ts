import { and, eq, sql } from "drizzle-orm";
import { categoryOptionError, isJsonObject } from "../_option-validation";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { categoryUpdateSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/db/schema";
import { getCategories } from "@/lib/data";

async function categoryOf(userId: string, categoryId: string) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, categoryId)))
    .get();
}

function categoryDtoOf(userId: string, categoryId: string) {
  return getCategories(userId).find((category) => category.id === categoryId) ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const row = await categoryOf(auth.user.id, id);
  if (!row) return jsonError("Kategori tidak ditemukan.", 404);

  const body = await readJson(request);
  if (!isJsonObject(body)) {
    return jsonError("Data kategori tidak valid.", 422);
  }

  if (body.type !== undefined && body.type !== row.type) {
    return jsonError(
      "Jenis kategori tidak bisa diubah. Hapus kategori ini lalu buat yang baru bila perlu.",
      422,
      { type: "Jenis kategori terkunci saat mengubah." },
    );
  }

  const optionError = categoryOptionError(body);
  if (optionError) {
    return jsonError(optionError.message, 422, {
      [optionError.field]: optionError.message,
    });
  }

  const parsed = categoryUpdateSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { name, icon, color } = parsed.data;
  if (name === undefined && icon === undefined && color === undefined) {
    return jsonError("Tidak ada perubahan yang dikirim.", 400);
  }

  if (name && name.toLowerCase() !== row.name.toLowerCase()) {
    const duplicate = db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.userId, auth.user.id),
          eq(categories.type, row.type),
          sql`lower(${categories.name}) = ${name.toLowerCase()}`,
        ),
      )
      .all()
      .find((candidate) => candidate.id !== id);
    if (duplicate) {
      return jsonError("Nama kategori itu sudah dipakai. Pilih nama lain.", 409, {
        name: "Nama kategori itu sudah dipakai.",
      });
    }
  }

  db.update(categories)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(color !== undefined ? { color } : {}),
    })
    .where(and(eq(categories.userId, auth.user.id), eq(categories.id, id)))
    .run();

  return jsonOk({ category: categoryDtoOf(auth.user.id, id) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const row = await categoryOf(auth.user.id, id);
  if (!row) return jsonError("Kategori tidak ditemukan.", 404);

  const usage = db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(eq(transactions.userId, auth.user.id), eq(transactions.categoryId, id)))
    .get();

  const usedBy = Number(usage?.count ?? 0);
  if (usedBy > 0) {
    return jsonError(
      `Kategori ini masih dipakai oleh ${usedBy} transaksi. Pindahkan transaksinya ke kategori lain dulu, lalu hapus kategori ini.`,
      409,
      { usage: String(usedBy) },
    );
  }

  try {
    db.delete(categories)
      .where(and(eq(categories.userId, auth.user.id), eq(categories.id, id)))
      .run();
  } catch (error) {
    // Jaga-jaga bila ada transaksi baru yang masuk di antara pengecekan dan hapus.
    if (error instanceof Error && /foreign key/i.test(error.message)) {
      return jsonError(
        "Kategori ini baru saja dipakai transaksi. Pindahkan transaksinya dulu, lalu hapus kategori ini.",
        409,
        { usage: String(usedBy) },
      );
    }
    throw error;
  }

  return jsonOk({ ok: true });
}
