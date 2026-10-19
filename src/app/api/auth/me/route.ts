import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Belum masuk.", 401);
  return jsonOk({ user });
}
