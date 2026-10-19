import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { createPendingTransaction } from "@/lib/inbox";
import { parseStatementCsv, statementExternalId } from "@/lib/statement-parser";

const bodySchema = z.object({
  csv: z
    .string()
    .min(1, "File mutasi kosong.")
    .max(1_500_000, "File mutasi terlalu besar (maks ±1,5 MB)."),
});

/**
 * Impor mutasi/e-Statement CSV ke Kotak Masuk sebagai transaksi tertunda.
 * Kolom yang didukung: tanggal, keterangan, nominal (atau debit/kredit).
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const raw = await readJson(request);
  const parsedBody = bodySchema.safeParse(raw);
  if (!parsedBody.success) return validationError(parsedBody.error);

  const { rows, skipped } = parseStatementCsv(parsedBody.data.csv);
  if (rows.length === 0) {
    return jsonError(
      "Tidak ada baris mutasi yang bisa dibaca. Pastikan ada kolom tanggal, keterangan, dan nominal (atau debit/kredit).",
      422,
    );
  }

  let imported = 0;
  let duplicates = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const result = await createPendingTransaction(auth.user.id, {
      source: "statement",
      type: row.type,
      amount: row.amount,
      date: row.date,
      note: row.note,
      rawSubject: "Impor mutasi",
      externalId: statementExternalId(row, index),
      confidence: "high",
    });
    if (result.created) imported += 1;
    else duplicates += 1;
  }

  return jsonOk({
    imported,
    skipped: skipped + duplicates,
    parsed: rows.length,
  });
}
