import { jsonOk, requireApiUser } from "@/lib/api";
import { getSummary } from "@/lib/data";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  return jsonOk({ summary: await getSummary(auth.user.id) });
}
