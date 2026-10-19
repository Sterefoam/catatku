import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { goalSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { getGoals } from "@/lib/data";

/** Pesan validasi jumlah terkumpul dalam bahasa Indonesia. */
const savedAmountSchema = z
  .number({ error: "Jumlah terkumpul tidak valid." })
  .int("Jumlah terkumpul harus bilangan bulat.")
  .min(0, "Jumlah terkumpul tidak boleh negatif.");

const createGoalSchema = goalSchema.extend({
  savedAmount: savedAmountSchema.optional(),
});

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  return jsonOk({ goals: await getGoals(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = createGoalSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(goals).values({
    id,
    userId: auth.user.id,
    name: parsed.data.name,
    targetAmount: parsed.data.targetAmount,
    savedAmount: parsed.data.savedAmount ?? 0,
    deadline: parsed.data.deadline ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const goal = (await getGoals(auth.user.id)).find((item) => item.id === id);
  if (!goal) return jsonError("Target gagal disimpan. Coba lagi.", 500);
  return jsonOk({ goal }, 201);
}
