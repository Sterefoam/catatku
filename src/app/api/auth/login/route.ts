import { isSecureRequest, jsonError, jsonOk, readJson, validationError } from "@/lib/api";
import { authenticate, AuthError, createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await readJson(request);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const user = authenticate(parsed.data.email, parsed.data.password);
    await createSession(user.id, { secure: isSecureRequest(request) });
    return jsonOk({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.status);
    }
    console.error("[login]", error);
    return jsonError("Gagal masuk. Coba lagi.", 500);
  }
}
