import { isSecureRequest, jsonError, jsonOk, readJson, validationError } from "@/lib/api";
import { createSession, createUser, isUniqueEmailError } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await readJson(request);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const user = createUser(parsed.data);
    await createSession(user.id, { secure: isSecureRequest(request) });
    return jsonOk({ user }, 201);
  } catch (error) {
    if (isUniqueEmailError(error)) {
      return jsonError("Email ini sudah terdaftar. Coba masuk saja.", 409);
    }
    if (error instanceof Error && error.name === "AuthError") {
      return jsonError(error.message, 409);
    }
    console.error("[register]", error);
    return jsonError("Akun gagal dibuat. Coba lagi.", 500);
  }
}
