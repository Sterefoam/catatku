import { eq } from "drizzle-orm";
import { jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { profileSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { toSessionUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  await db
    .update(users)
    .set({ name: parsed.data.name, currency: parsed.data.currency })
    .where(eq(users.id, auth.user.id));

  const rows = await db.select().from(users).where(eq(users.id, auth.user.id));
  const row = rows[0];
  if (!row) return jsonOk({ user: null });
  return jsonOk({ user: toSessionUser(row) });
}
