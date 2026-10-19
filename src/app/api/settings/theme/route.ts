import { eq } from "drizzle-orm";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { themeSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = themeSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  db.update(users)
    .set({ theme: parsed.data.theme })
    .where(eq(users.id, auth.user.id))
    .run();

  return jsonOk({ theme: parsed.data.theme });
}
