import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { addWatchlistItem, listWatchlist, removeWatchlistItem } from "@/lib/trading/data";

export const dynamic = "force-dynamic";

const addSchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9.\-]{0,9}$/, "Simbol tidak valid (contoh: TSLA)."),
  name: z.string().trim().max(120).optional(),
});

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  return jsonOk({ items: await listWatchlist(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const item = await addWatchlistItem(auth.user.id, parsed.data.symbol, {
    name: parsed.data.name ?? null,
    source: "manual",
  });
  return jsonOk({ item }, 201);
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
    return jsonError("Simbol tidak valid.", 422);
  }
  await removeWatchlistItem(auth.user.id, symbol);
  return jsonOk({ ok: true });
}
