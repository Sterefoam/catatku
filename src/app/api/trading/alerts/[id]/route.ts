import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { deleteAlert, updateAlert } from "@/lib/trading/data";

export const dynamic = "force-dynamic";

const patchAlertSchema = z
  .object({
    isActive: z.boolean({ error: "Status alert tidak valid." }).optional(),
    /** Diisi null untuk mengaktifkan ulang alert yang sudah terpicu. */
    triggeredAt: z.string().nullable().optional(),
  })
  .strict()
  .refine((value) => value.isActive !== undefined || value.triggeredAt !== undefined, {
    message: "Tidak ada perubahan yang dikirim.",
  });

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/trading/alerts/[id] — aktif/nonaktifkan alert. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await readJson(request);
  const parsed = patchAlertSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const alert = await updateAlert(auth.user.id, id, parsed.data);
  if (!alert) return jsonError("Alert tidak ditemukan.", 404);
  return jsonOk({ alert });
}

/** DELETE /api/trading/alerts/[id] — hapus alert. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  // updateAlert dengan patch kosong dipakai untuk memastikan alert milik user
  // (tanpa batas 50 baris seperti listAlerts).
  if (!(await updateAlert(auth.user.id, id, {}))) {
    return jsonError("Alert tidak ditemukan.", 404);
  }
  await deleteAlert(auth.user.id, id);
  return jsonOk({ ok: true });
}
