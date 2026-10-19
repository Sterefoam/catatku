import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { importSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { toMinor } from "@/lib/money";
import { randomUUID } from "node:crypto";

/**
 * Memulihkan transaksi dari cadangan JSON Catatku.
 * Kategori dicocokkan berdasarkan nama+jenis; dibuat otomatis bila belum ada.
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const existing = db
    .select()
    .from(categories)
    .where(eq(categories.userId, auth.user.id))
    .all();

  const lookup = new Map<string, string>();
  for (const row of existing) {
    lookup.set(`${row.type}:${row.name.toLowerCase()}`, row.id);
  }

  const now = new Date().toISOString();
  let imported = 0;

  for (const item of parsed.data.transactions) {
    const categoryName = (item.category ?? "Lainnya").trim() || "Lainnya";
    const key = `${item.type}:${categoryName.toLowerCase()}`;
    let categoryId = lookup.get(key);

    if (!categoryId) {
      categoryId = randomUUID();
      db.insert(categories)
        .values({
          id: categoryId,
          userId: auth.user.id,
          name: categoryName,
          type: item.type,
          icon: item.type === "income" ? "plus-circle" : "ellipsis",
          color: item.type === "income" ? "#16A34A" : "#64748B",
          isDefault: false,
          createdAt: now,
        })
        .run();
      lookup.set(key, categoryId);
    }

    db.insert(transactions)
      .values({
        id: randomUUID(),
        userId: auth.user.id,
        categoryId,
        type: item.type,
        amount: toMinor(item.amount, auth.user.currency),
        note: item.note?.trim() || null,
        date: item.date,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    imported += 1;
  }

  return jsonOk({ imported });
}
