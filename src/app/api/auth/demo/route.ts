import { isSecureRequest, jsonError, jsonOk } from "@/lib/api";
import { authenticate, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoData } from "@/lib/db/demo-seed";
import { isDemoLoginEnabled } from "@/lib/features";

/**
 * Masuk cepat ke akun demo — hanya untuk pengembangan lokal.
 * Di produksi endpoint ini dinonaktifkan secara default (ENABLE_DEMO_LOGIN tidak diisi).
 */
export async function POST(request: Request) {
  if (!isDemoLoginEnabled()) {
    return jsonError("Akun demo tidak tersedia di lingkungan produksi.", 404);
  }

  try {
    await seedDemoData(db);
    const user = await authenticate(DEMO_EMAIL, DEMO_PASSWORD);
    await createSession(user.id, { secure: isSecureRequest(request) });
    return jsonOk({ user });
  } catch (error) {
    console.error("[demo-login]", error);
    return jsonError("Akun demo gagal disiapkan.", 500);
  }
}
