import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { goalUpdateSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { getGoals } from "@/lib/data";

/** Pesan validasi jumlah terkumpul dalam bahasa Indonesia. */
const savedAmountSchema = z
  .number({ error: "Jumlah terkumpul tidak valid." })
  .int("Jumlah terkumpul harus bilangan bulat.")
  .min(0, "Jumlah terkumpul tidak boleh negatif.");

const updateGoalSchema = goalUpdateSchema.extend({
  savedAmount: savedAmountSchema.optional(),
});

async function findGoal(userId: string, goalId: string) {
  const rows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.id, goalId)));
  return rows[0];
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!(await findGoal(auth.user.id, id))) return jsonError("Target tidak ditemukan.", 404);

  const body = await readJson(request);
  const parsed = updateGoalSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  await db
    .update(goals)
    .set({
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.targetAmount !== undefined
        ? { targetAmount: parsed.data.targetAmount }
        : {}),
      ...(parsed.data.savedAmount !== undefined
        ? { savedAmount: parsed.data.savedAmount }
        : {}),
      ...(parsed.data.deadline !== undefined
        ? { deadline: parsed.data.deadline ?? null }
        : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(goals.userId, auth.user.id), eq(goals.id, id)));

  const goal = (await getGoals(auth.user.id)).find((item) => item.id === id);
  if (!goal) return jsonError("Target tidak ditemukan.", 404);
  return jsonOk({ goal });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await db
    .delete(goals)
    .where(and(eq(goals.userId, auth.user.id), eq(goals.id, id)));

  if (Number(result.rowsAffected ?? 0) === 0) {
    return jsonError("Target tidak ditemukan.", 404);
  }
  return jsonOk({ ok: true });
}
