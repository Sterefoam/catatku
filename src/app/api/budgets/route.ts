import { and, eq, isNull } from "drizzle-orm";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { budgetSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { budgets } from "@/lib/db/schema";
import { getBudgetUsage } from "@/lib/data";
import { monthKey, todayISO } from "@/lib/date";

/** Periode batas belanja: "YYYY-MM" dengan bulan 01–12. */
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function isValidPeriod(period: string): boolean {
  return PERIOD_PATTERN.test(period);
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const period = new URL(request.url).searchParams.get("period") ?? monthKey(todayISO());
  if (!isValidPeriod(period)) {
    return jsonError("Periode tidak valid. Gunakan format YYYY-MM.", 422);
  }
  return jsonOk({ usage: getBudgetUsage(auth.user.id, period) });
}

/** Simpan / ubah batas belanja bulanan (satu batas global per bulan). */
export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = budgetSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const period = parsed.data.period ?? monthKey(todayISO());
  if (!isValidPeriod(period)) {
    return jsonError("Periode tidak valid. Gunakan format YYYY-MM.", 422);
  }
  const now = new Date().toISOString();

  const existing = db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, auth.user.id),
        eq(budgets.period, period),
        isNull(budgets.categoryId),
      ),
    )
    .get();

  if (existing) {
    db.update(budgets)
      .set({ limitAmount: parsed.data.limitAmount })
      .where(eq(budgets.id, existing.id))
      .run();
  } else {
    db.insert(budgets)
      .values({
        id: crypto.randomUUID(),
        userId: auth.user.id,
        categoryId: null,
        limitAmount: parsed.data.limitAmount,
        period,
        createdAt: now,
      })
      .run();
  }

  return jsonOk({ usage: getBudgetUsage(auth.user.id, period) });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const period = new URL(request.url).searchParams.get("period") ?? monthKey(todayISO());
  if (!isValidPeriod(period)) {
    return jsonError("Periode tidak valid. Gunakan format YYYY-MM.", 422);
  }

  db.delete(budgets)
    .where(
      and(
        eq(budgets.userId, auth.user.id),
        eq(budgets.period, period),
        isNull(budgets.categoryId),
      ),
    )
    .run();

  return jsonOk({ usage: getBudgetUsage(auth.user.id, period) });
}
