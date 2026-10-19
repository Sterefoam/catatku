import { eq } from "drizzle-orm";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { reminderSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { reminders } from "@/lib/db/schema";
import { getReminder } from "@/lib/data";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  return jsonOk({ reminder: getReminder(auth.user.id) });
}

/**
 * Simpan pengaturan pengingat (satu baris per pengguna).
 * Menerima body lengkap `{ time, days, isActive, budgetAlertEnabled }`, dan juga
 * body sebagian (mis. hanya `{ isActive }` saat sakelar diubah) — field yang
 * tidak dikirim dipertahankan dari pengaturan tersimpan.
 */
export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Data pengingat tidak valid.", 400);
  }

  const current = getReminder(auth.user.id);
  const merged = {
    time: current.time,
    days: current.days,
    isActive: current.isActive,
    budgetAlertEnabled: current.budgetAlertEnabled,
    ...(body as Record<string, unknown>),
  };

  const parsed = reminderSchema.safeParse(merged);
  if (!parsed.success) return validationError(parsed.error);

  const now = new Date().toISOString();
  const values = {
    time: parsed.data.time,
    days: parsed.data.days.join(","),
    isActive: parsed.data.isActive,
    budgetAlertEnabled: parsed.data.budgetAlertEnabled,
    updatedAt: now,
  };

  try {
    const existing = db
      .select()
      .from(reminders)
      .where(eq(reminders.userId, auth.user.id))
      .get();

    if (existing) {
      db.update(reminders).set(values).where(eq(reminders.id, existing.id)).run();
    } else {
      db.insert(reminders)
        .values({
          id: crypto.randomUUID(),
          userId: auth.user.id,
          createdAt: now,
          ...values,
        })
        .run();
    }
  } catch (error) {
    console.error("[reminders-put]", error);
    return jsonError("Pengingat gagal disimpan. Coba lagi.", 500);
  }

  return jsonOk({ reminder: getReminder(auth.user.id) });
}
