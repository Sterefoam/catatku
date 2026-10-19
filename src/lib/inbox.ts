import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, ensureDatabaseReady } from "./db";
import { categories, pendingTransactions } from "./db/schema";
import { createTransaction } from "./data";
import type { TransactionDTO, TxType } from "./types";

export type PendingSource = "email" | "statement";
export type PendingStatus = "pending" | "confirmed" | "ignored";
export type PendingConfidence = "high" | "low";

export interface PendingTransactionDTO {
  id: string;
  source: PendingSource;
  type: TxType;
  amount: number;
  date: string;
  note: string | null;
  rawSubject: string | null;
  createdAt: string;
  confidence: PendingConfidence | null;
}

export interface PendingTransactionInput {
  source: PendingSource;
  type: TxType;
  amount: number;
  date: string;
  note?: string | null;
  rawSubject?: string | null;
  rawFrom?: string | null;
  confidence?: PendingConfidence | null;
  externalId?: string;
}

export class InboxError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function fingerprint(input: PendingTransactionInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.source,
        input.type,
        input.amount,
        input.date,
        input.note ?? "",
        input.rawSubject ?? "",
      ]),
    )
    .digest("hex");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error && /unique constraint failed/i.test(error.message)
  );
}

/** Simpan transaksi tertunda; duplikat (externalId/fingerprint) diabaikan. */
export async function createPendingTransaction(
  userId: string,
  input: PendingTransactionInput,
): Promise<{ created: boolean; id: string | null }> {
  await ensureDatabaseReady();

  const externalId = input.externalId?.trim() || fingerprint(input);
  const now = new Date().toISOString();
  const id = randomUUID();

  try {
    await db.insert(pendingTransactions).values({
      id,
      userId,
      source: input.source,
      externalId,
      type: input.type,
      amount: input.amount,
      note: input.note?.trim() ? input.note.trim() : null,
      date: input.date,
      rawSubject: input.rawSubject?.slice(0, 300) ?? null,
      rawFrom: input.rawFrom?.slice(0, 200) ?? null,
      confidence: input.confidence ?? null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { created: true, id };
  } catch (error) {
    if (isUniqueViolation(error)) return { created: false, id: null };
    throw error;
  }
}

export async function listPendingTransactions(
  userId: string,
): Promise<PendingTransactionDTO[]> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(pendingTransactions)
    .where(
      and(
        eq(pendingTransactions.userId, userId),
        eq(pendingTransactions.status, "pending"),
      ),
    )
    .orderBy(desc(pendingTransactions.createdAt));

  return rows.map((row) => ({
    id: row.id,
    source: row.source === "email" ? "email" : "statement",
    type: row.type === "income" ? "income" : "expense",
    amount: row.amount,
    date: row.date,
    note: row.note,
    rawSubject: row.rawSubject,
    createdAt: row.createdAt,
    confidence:
      row.confidence === "high" ? "high" : row.confidence === "low" ? "low" : null,
  }));
}

export async function countPendingTransactions(userId: string): Promise<number> {
  await ensureDatabaseReady();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(pendingTransactions)
    .where(
      and(
        eq(pendingTransactions.userId, userId),
        eq(pendingTransactions.status, "pending"),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/** Konfirmasi transaksi tertunda → catat sebagai transaksi final. */
export async function confirmPendingTransaction(
  userId: string,
  pendingId: string,
  categoryId: string,
): Promise<TransactionDTO> {
  await ensureDatabaseReady();

  const rows = await db
    .select()
    .from(pendingTransactions)
    .where(
      and(
        eq(pendingTransactions.userId, userId),
        eq(pendingTransactions.id, pendingId),
      ),
    );
  const pending = rows[0];
  if (!pending) throw new InboxError("Transaksi tertunda tidak ditemukan.", 404);
  if (pending.status !== "pending") {
    throw new InboxError("Transaksi ini sudah diproses.", 409);
  }

  const categoryRows = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.userId, userId), eq(categories.id, categoryId)),
    );
  const category = categoryRows[0];
  if (!category) throw new InboxError("Kategori tidak ditemukan.", 404);
  if (category.type !== pending.type) {
    throw new InboxError(
      "Jenis kategori tidak cocok dengan jenis transaksi.",
      422,
    );
  }

  const transaction = await createTransaction(userId, {
    type: pending.type === "income" ? "income" : "expense",
    amount: pending.amount,
    categoryId,
    date: pending.date,
    note: pending.note ?? pending.rawSubject ?? null,
  });

  await db
    .update(pendingTransactions)
    .set({ status: "confirmed", updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(pendingTransactions.userId, userId),
        eq(pendingTransactions.id, pendingId),
      ),
    );

  return transaction;
}

export async function ignorePendingTransaction(
  userId: string,
  pendingId: string,
): Promise<boolean> {
  await ensureDatabaseReady();
  const result = await db
    .update(pendingTransactions)
    .set({ status: "ignored", updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(pendingTransactions.userId, userId),
        eq(pendingTransactions.id, pendingId),
        eq(pendingTransactions.status, "pending"),
      ),
    );
  return Number(result.rowsAffected ?? 0) > 0;
}
