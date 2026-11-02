import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { createPlan, listPlans } from "@/lib/trading/data";
import { computePlan } from "@/lib/trading/plan-engine";
import type { PlanPreview, PlanStatus } from "@/lib/trading/types";
import {
  PLAN_CONTEXT_ERROR,
  loadPlanContext,
  planDraftSchema,
  toPlanDraft,
} from "./_plan-context";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 30;

const PLAN_STATUSES: PlanStatus[] = ["draft", "active", "triggered", "done", "cancelled"];

function parseStatuses(raw: string | null): PlanStatus[] | undefined {
  if (!raw) return undefined;
  const wanted = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is PlanStatus => PLAN_STATUSES.includes(value as PlanStatus));
  return wanted.length ? wanted : undefined;
}

/** GET /api/trading/plans?status=active,triggered — daftar rencana milik pengguna. */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const plans = await listPlans(auth.user.id, parseStatuses(searchParams.get("status")));
  return jsonOk({ plans });
}

/**
 * POST /api/trading/plans
 * Body: PlanDraft & { note? }. Hitung ulang dengan data pasar terbaru lalu
 * simpan sebagai rencana aktif. Ditolak 422 bila ada cek risiko yang gagal.
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

  if (!preview.ok) {
    const details: Record<string, string> = {};
    for (const check of preview.checks) {
      if (check.status === "fail" && !details[check.id]) {
        details[check.id] = `${check.label} — ${check.detail}`;
      }
    }
    const firstFail = preview.checks.find((check) => check.status === "fail");
    const message =
      preview.errors[0] ??
      (firstFail ? `${firstFail.label}: ${firstFail.detail}` : "Rencana belum lolos cek risiko.");
    return jsonError(message, 422, details);
  }

  const plan = await createPlan(auth.user.id, {
    symbol: draft.symbol,
    setupType: draft.setupType,
    status: "active",
    entryTrigger: draft.entryTrigger,
    entry: preview.entry,
    stop: preview.stop,
    target: preview.target,
    stopRule: preview.stopRuleLabel,
    targetRule: preview.targetRuleLabel,
    rMultiple: preview.rMultiple,
    riskPerShare: preview.riskPerShare,
    riskAmount: preview.size.riskAmount,
    qty: preview.size.qty,
    orHigh: preview.orHigh,
    orLow: preview.orLow,
    orMinutes: draft.orMinutes ?? 15,
    flatBy: preview.flatBy,
    checks: preview.checks,
    size: preview.size,
    note: parsed.data.note ?? null,
  });

  return jsonOk({ plan }, 201);
}
