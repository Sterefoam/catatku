import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import {
  getOrder,
  getPlan,
  getTradingSettings,
  getTradingStats,
  updateOrder,
  updatePlan,
} from "@/lib/trading/data";
import { fetchQuote } from "@/lib/trading/yahoo";

export const dynamic = "force-dynamic";

const orderActionSchema = z
  .object({
    action: z.enum(["fill", "close", "cancel"], { error: "Aksi order tidak dikenal." }),
    price: z
      .number({ error: "Harga tidak valid." })
      .int("Harga harus bilangan bulat dalam sen.")
      .positive("Harga harus lebih dari nol.")
      .max(100_000_000, "Harga terlalu besar.")
      .nullable()
      .optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

/** Harga pasar terakhir untuk sebuah simbol (null bila data tidak tersedia). */
async function lastMarketPrice(symbol: string): Promise<number | null> {
  const quote = await fetchQuote(symbol).catch(() => null);
  return quote && quote.price > 0 ? quote.price : null;
}

/** PATCH /api/trading/orders/[id] — isi, tutup, atau batalkan order kertas. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const order = await getOrder(auth.user.id, id);
  if (!order) return jsonError("Order tidak ditemukan.", 404);

  const body = await readJson(request);
  const parsed = orderActionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { action } = parsed.data;
  const manualPrice = parsed.data.price ?? null;
  const nowIso = new Date().toISOString();
  let planPatch: { status: "triggered" | "done" } | null = null;

  if (action === "fill") {
    if (order.status !== "pending") {
      return jsonError("Hanya order yang masih menunggu bisa diisi.", 422);
    }
    const price = manualPrice ?? (await lastMarketPrice(order.symbol));
    if (!price) {
      return jsonError(
        "Harga pasar terakhir belum tersedia. Isi harga pengisian secara manual.",
        422,
      );
    }
    const updated = await updateOrder(auth.user.id, id, {
      status: "filled",
      filledPrice: price,
      filledAt: nowIso,
    });
    if (!updated) return jsonError("Order tidak ditemukan.", 404);
    planPatch = { status: "triggered" };
  } else if (action === "close") {
    if (order.status !== "pending" && order.status !== "filled") {
      return jsonError("Order ini sudah selesai atau dibatalkan.", 422);
    }
    const price = manualPrice ?? (await lastMarketPrice(order.symbol));
    if (!price) {
      return jsonError(
        "Harga pasar terakhir belum tersedia. Isi harga penutupan secara manual.",
        422,
      );
    }
    const exitReason = price <= order.stop ? "stop" : price >= order.target ? "target" : "manual";
    const pnl = (price - order.entry) * order.qty;
    const updated = await updateOrder(auth.user.id, id, {
      status: "closed",
      closedPrice: price,
      closedAt: nowIso,
      exitReason,
      pnl,
    });
    if (!updated) return jsonError("Order tidak ditemukan.", 404);
    planPatch = { status: "done" };
  } else {
    if (order.status !== "pending") {
      return jsonError("Hanya order yang masih menunggu bisa dibatalkan.", 422);
    }
    const updated = await updateOrder(auth.user.id, id, { status: "cancelled" });
    if (!updated) return jsonError("Order tidak ditemukan.", 404);
  }

  // Sinkronkan status rencana asal: terisi → "triggered", selesai → "done".
  if (planPatch && order.planId) {
    const plan = await getPlan(auth.user.id, order.planId);
    if (plan && plan.status !== "done" && plan.status !== "cancelled") {
      await updatePlan(auth.user.id, plan.id, { status: planPatch.status });
    }
  }

  const [fresh, settings] = await Promise.all([
    getOrder(auth.user.id, id),
    getTradingSettings(auth.user.id),
  ]);
  if (!fresh) return jsonError("Order tidak ditemukan.", 404);
  const stats = await getTradingStats(auth.user.id, settings);
  return jsonOk({ order: fresh, stats });
}
