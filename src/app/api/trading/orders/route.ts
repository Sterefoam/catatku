import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { createOrder, getPlan, getTradingSettings, getTradingStats, listOrders } from "@/lib/trading/data";
import { computePlan } from "@/lib/trading/plan-engine";
import type { PlanDraft, PlanPreview } from "@/lib/trading/types";
import {
  PLAN_CONTEXT_ERROR,
  loadPlanContext,
} from "../plans/_plan-context";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 30;

const createOrderSchema = z
  .object({
    planId: z.string({ error: "Rencana wajib dipilih." }).trim().min(1, "Rencana wajib dipilih."),
  })
  .strict();

/** GET /api/trading/orders — daftar order kertas + statistik risiko hari ini. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const settings = await getTradingSettings(auth.user.id);
  const [orders, stats] = await Promise.all([
    listOrders(auth.user.id, 100),
    getTradingStats(auth.user.id, settings),
  ]);
  return jsonOk({ orders, stats });
}

/**
 * POST /api/trading/orders — buat order kertas dari rencana aktif.
 * Risiko dihitung ulang dengan data pasar terbaru; ditolak 422 bila ada cek
 * yang gagal. Qty diambil dari hasil hitung server (bukan dari body).
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const plan = await getPlan(auth.user.id, parsed.data.planId);
  if (!plan) return jsonError("Rencana tidak ditemukan.", 404);
  if (plan.status !== "active" && plan.status !== "triggered") {
    return jsonError(
      "Rencana ini tidak aktif lagi. Buat rencana baru atau aktifkan ulang dulu.",
      422,
    );
  }

  // Susun ulang draft dari rencana tersimpan: stop & target dikunci ke harga
  // rencana, sedangkan entry tetap harga pemicu rencana.
  const draft: PlanDraft = {
    symbol: plan.symbol,
    setupType: plan.setupType,
    entryTrigger: plan.entry,
    stopRule: "price",
    stopPrice: plan.stop,
    targetRule: "price",
    targetPrice: plan.target,
    orHigh: plan.orHigh,
    orLow: plan.orLow,
    orMinutes: null,
    flatBy: plan.flatBy,
    note: null,
  };

  let preview: PlanPreview;
  try {
    const { settings, context } = await loadPlanContext(auth.user.id, draft);
    preview = computePlan(draft, settings, context);
  } catch {
    return jsonError(PLAN_CONTEXT_ERROR, 422);
  }

  if (!preview.ok) {
    const firstFail = preview.checks.find((check) => check.status === "fail");
    const message =
      preview.errors[0] ??
      (firstFail
        ? `${firstFail.label}: ${firstFail.detail}`
        : "Order belum lolos cek risiko. Periksa rencana dan pengaturan risikomu.");
    return jsonError(message, 422);
  }

  if (preview.size.qty <= 0) {
    return jsonError(
      "Ukuran posisi 0 lembar. Perkecil risiko atau longgarkan batas agar minimal 1 lembar.",
      422,
    );
  }

  // Qty diambil dari rencana yang tersimpan di server (bukan body); risiko
  // dihitung ulang dengan stop/target yang sama seperti saat rencana dibuat.
  const qty = plan.size.qty > 0 ? plan.size.qty : preview.size.qty;
  const riskAmount = qty * Math.max(0, preview.riskPerShare);

  const order = await createOrder(auth.user.id, {
    planId: plan.id,
    symbol: plan.symbol,
    qty,
    entry: preview.entry,
    stop: preview.stop,
    target: preview.target,
    riskAmount,
  });

  return jsonOk({ order }, 201);
}
