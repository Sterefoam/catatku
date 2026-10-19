import { and, eq, sql } from "drizzle-orm";
import { categoryOptionError, isJsonObject } from "./_option-validation";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { categorySchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { getCategories } from "@/lib/data";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  return jsonOk({ categories: getCategories(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  if (!isJsonObject(body)) {
    return jsonError("Data kategori tidak valid.", 422);
  }

  const optionError = categoryOptionError(body);
  if (optionError) {
    return jsonError(optionError.message, 422, {
      [optionError.field]: optionError.message,
    });
  }

  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const duplicate = db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, auth.user.id),
        eq(categories.type, parsed.data.type),
        sql`lower(${categories.name}) = ${parsed.data.name.toLowerCase()}`,
      ),
    )
    .get();

  if (duplicate) {
    return jsonError(
      "Kategori dengan nama itu sudah ada. Pakai nama lain atau ubah kategori yang sudah ada.",
      409,
    );
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.insert(categories)
    .values({
      id,
      userId: auth.user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      icon: parsed.data.icon,
      color: parsed.data.color,
      isDefault: false,
      createdAt: now,
    })
    .run();

  const created = getCategories(auth.user.id).find((category) => category.id === id) ?? null;
  return jsonOk({ category: created }, 201);
}
