import { eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "./db";
import {
  budgets,
  categories,
  goals,
  pendingTransactions,
  reminders,
  sessions,
  transactions,
  users,
} from "./db/schema";

/**
 * Menghapus akun pengguna beserta seluruh datanya.
 * Urutan penting agar tidak melanggar foreign key (transaksi → kategori).
 */
export async function deleteAccount(userId: string): Promise<void> {
  await ensureDatabaseReady();

  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db
    .delete(pendingTransactions)
    .where(eq(pendingTransactions.userId, userId));
  await db.delete(budgets).where(eq(budgets.userId, userId));
  await db.delete(goals).where(eq(goals.userId, userId));
  await db.delete(reminders).where(eq(reminders.userId, userId));
  await db.delete(categories).where(eq(categories.userId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}
