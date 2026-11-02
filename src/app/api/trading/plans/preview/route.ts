import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { computePlan } from "@/lib/trading/plan-engine";
import type { PlanPreview } from "@/lib/trading/types";
import {
  PLAN_CONTEXT_ERROR,
  loadPlanContext,
  planDraftSchema,
  toPlanDraft,
} from "../_plan-context";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 30;

/**
 * POST /api/trading/plans/preview
 * Body: PlanDraft (semua harga SEN). Respons: { preview: PlanPreview }.
 * Tidak menulis apa pun ke DB — hanya menghitung rencana.
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = planDraftSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const draft = toPlanDraft(parsed.data);
  let preview: PlanPreview;
  try {
    const { settings, context } = await loadPlanContext(auth.user.id, draft);
    preview = computePlan(draft, settings, context);
  } catch {
    return jsonError(PLAN_CONTEXT_ERROR, 422);
  }

  return jsonOk({ preview });
}
