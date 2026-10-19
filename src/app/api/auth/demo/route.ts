import { jsonError, jsonOk } from "@/lib/api";
import { authenticate, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoData } from "@/lib/db/demo-seed";

/** Masuk cepat ke akun demo yang sudah terisi data contoh. */
export async function POST() {
  try {
    seedDemoData(db);
    const user = authenticate(DEMO_EMAIL, DEMO_PASSWORD);
    await createSession(user.id);
    return jsonOk({ user });
  } catch (error) {
    console.error("[demo-login]", error);
    return jsonError("Akun demo gagal disiapkan.", 500);
  }
}
