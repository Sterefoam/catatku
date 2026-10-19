import { jsonOk } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export async function POST() {
  await destroySession();
  return jsonOk({ ok: true });
}
