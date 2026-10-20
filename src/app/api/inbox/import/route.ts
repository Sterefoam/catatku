import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { createPendingTransaction } from "@/lib/inbox";
import { parseStatementPdf, pdfStatementExternalId } from "@/lib/statement-pdf";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 4 * 1024 * 1024;

const bodySchema = z.object({
  pdfBase64: z
    .string()
    .min(100, "File PDF kosong.")
    .max(5_800_000, "File PDF terlalu besar (maks 4 MB)."),
  fileName: z.string().max(200).optional(),
});

/**
 * Impor mutasi/e-Statement **PDF** ke Kotak Masuk sebagai transaksi tertunda.
 * Teks PDF diekstrak lalu setiap baris bertanggal + nominal dijadikan transaksi
 * (perlu dikonfirmasi karena format bank berbeda-beda).
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const raw = await readJson(request);
  const parsedBody = bodySchema.safeParse(raw);
  if (!parsedBody.success) return validationError(parsedBody.error);

  const base64 = parsedBody.data.pdfBase64.replace(/^data:application\/pdf;base64,/i, "");
  let buffer: Uint8Array;
  try {
    buffer = new Uint8Array(Buffer.from(base64, "base64"));
  } catch {
    return jsonError("File PDF tidak valid.", 422);
  }
  if (buffer.byteLength === 0) return jsonError("File PDF kosong.", 422);
  if (buffer.byteLength > MAX_PDF_BYTES) {
    return jsonError("Ukuran PDF melebihi 4 MB. Pecah file atau kompres dulu.", 413);
  }

  let result: Awaited<ReturnType<typeof parseStatementPdf>>;
  try {
    result = await parseStatementPdf(buffer);
  } catch (error) {
    console.error("[inbox-import-pdf]", error);
    return jsonError(
      "PDF gagal dibaca. Pastikan file tidak terkunci/berpassword dan berisi teks (bukan hasil scan gambar).",
      422,
    );
  }

  if (result.rows.length === 0) {
    return jsonError(
      `PDF terbaca (${result.pages} halaman), tetapi tidak ada baris mutasi yang dikenali. ` +
        "Pastikan PDF berisi tabel mutasi (bukan hanya ringkasan), atau kirim contoh PDF agar parser disesuaikan.",
      422,
    );
  }

  let imported = 0;
  let duplicates = 0;
  for (let index = 0; index < result.rows.length; index += 1) {
    const row = result.rows[index];
    const created = await createPendingTransaction(auth.user.id, {
      source: "statement",
      type: row.type,
      amount: row.amount,
      date: row.date,
      note: row.note,
      rawSubject: parsedBody.data.fileName
        ? `Mutasi PDF · ${parsedBody.data.fileName}`
        : "Mutasi PDF",
      externalId: pdfStatementExternalId(row, index),
      confidence: row.confidence,
    });
    if (created.created) imported += 1;
    else duplicates += 1;
  }

  return jsonOk({
    imported,
    skipped: result.skipped + duplicates,
    parsed: result.rows.length,
    pages: result.pages,
  });
}
