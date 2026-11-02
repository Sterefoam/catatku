import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { deletePlan, getPlan, updatePlan } from "@/lib/trading/data";

export const dynamic = "force-dynamic";

const updatePlanSchema = z
  .object({
    status: z
      .enum(["draft", "active", "triggered", "done", "cancelled"], {
        error: "Status rencana tidak dikenal.",
      })
      .optional(),
    note: z
      .string()
      .trim()
      .max(400, "Catatan maksimal 400 karakter.")
      .nullable()
      .optional(),
    entry: z
      .number({ error: "Harga entry tidak valid." })
      .int("Harga entry harus bilangan bulat sen.")
      .positive("Harga entry harus lebih dari nol.")
      .max(100_000_000, "Harga entry terlalu besar.")
      .nullable()
      .optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/trading/plans/[id] — ubah status, catatan, atau harga entry. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!(await getPlan(auth.user.id, id))) {
    return jsonError("Rencana tidak ditemukan.", 404);
  }

  const body = await readJson(request);
  const parsed = updatePlanSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const plan = await updatePlan(auth.user.id, id, parsed.data);
  if (!plan) return jsonError("Rencana tidak ditemukan.", 404);
  return jsonOk({ plan });
}

/** DELETE /api/trading/plans/[id] — hapus rencana. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!(await getPlan(auth.user.id, id))) {
    return jsonError("Rencana tidak ditemukan.", 404);
  }
  await deletePlan(auth.user.id, id);
  return jsonOk({ ok: true });
}
