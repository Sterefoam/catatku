import { and, asc, desc, eq, gte, like, lte, or, sql, type SQL } from "drizzle-orm";
import { db, ensureDatabaseReady } from "./db";
import {
  budgets,
  categories,
  goals,
  reminders,
  transactions,
} from "./db/schema";
import { monthKey, monthLabel, resolveRange, todayISO } from "./date";
import type {
  BudgetDTO,
  BudgetUsageDTO,
  CategoryDTO,
  GoalDTO,
  ReminderDTO,
  SummaryDTO,
  TransactionDTO,
  TransactionInput,
  TxType,
} from "./types";

/* ------------------------------------------------------------------ */
/* Transaksi                                                           */
/* ------------------------------------------------------------------ */

interface JoinedTransactionRow {
  id: string;
  categoryId: string;
  type: string;
  amount: number;
  note: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  categoryType: string;
}

function baseTransactionQuery() {
  return db
    .select({
      id: transactions.id,
      categoryId: transactions.categoryId,
      type: transactions.type,
      amount: transactions.amount,
      note: transactions.note,
      date: transactions.date,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      categoryType: categories.type,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id));
}

export function toTransactionDTO(row: JoinedTransactionRow): TransactionDTO {
  const type = (row.type === "income" ? "income" : "expense") as TxType;
  return {
    id: row.id,
    categoryId: row.categoryId,
    type,
    amount: row.amount,
    note: row.note,
    date: row.date,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      icon: row.categoryIcon,
      color: row.categoryColor,
      type: (row.categoryType === "income" ? "income" : "expense") as TxType,
    },
  };
}

export interface ListTransactionsOptions {
  limit?: number;
  offset?: number;
  type?: TxType;
  categoryId?: string;
  q?: string;
  from?: string;
  to?: string;
}

export async function listTransactions(
  userId: string,
  options: ListTransactionsOptions = {},
): Promise<TransactionDTO[]> {
  await ensureDatabaseReady();
  const clauses: SQL[] = [eq(transactions.userId, userId)];

  if (options.type) clauses.push(eq(transactions.type, options.type));
  if (options.categoryId) clauses.push(eq(transactions.categoryId, options.categoryId));
  if (options.from) clauses.push(gte(transactions.date, options.from));
  if (options.to) clauses.push(lte(transactions.date, options.to));
  if (options.q?.trim()) {
    const term = `%${options.q.trim().toLowerCase()}%`;
    const condition = or(
      like(sql`lower(coalesce(${transactions.note}, ''))`, term),
      like(sql`lower(${categories.name})`, term),
    );
    if (condition) clauses.push(condition);
  }

  const limit = Math.min(Math.max(options.limit ?? 300, 1), 5000);
  const offset = Math.max(options.offset ?? 0, 0);

  const rows = await baseTransactionQuery()
    .where(and(...clauses))
    .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
    .limit(limit)
    .offset(offset);

  return rows.map(toTransactionDTO);
}

export async function listAllTransactions(userId: string): Promise<TransactionDTO[]> {
  return listTransactions(userId, { limit: 5000 });
}

export async function getRecentTransactions(
  userId: string,
  limit = 5,
): Promise<TransactionDTO[]> {
  return listTransactions(userId, { limit });
}

export async function getTransactionById(
  userId: string,
  transactionId: string,
): Promise<TransactionDTO | null> {
  await ensureDatabaseReady();
  const rows = await baseTransactionQuery().where(
    and(eq(transactions.userId, userId), eq(transactions.id, transactionId)),
  );
  const row = rows[0];
  return row ? toTransactionDTO(row) : null;
}

export async function createTransaction(
  userId: string,
  input: TransactionInput,
): Promise<TransactionDTO> {
  await ensureDatabaseReady();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(transactions).values({
    id,
    userId,
    categoryId: input.categoryId,
    type: input.type,
    amount: input.amount,
    note: input.note?.trim() ? input.note.trim() : null,
    date: input.date,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getTransactionById(userId, id);
  if (!created) throw new Error("Transaksi gagal disimpan.");
  return created;
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: Partial<TransactionInput>,
): Promise<TransactionDTO | null> {
  await ensureDatabaseReady();
  const exists = await getTransactionById(userId, transactionId);
  if (!exists) return null;

  await db
    .update(transactions)
    .set({
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.date ? { date: input.date } : {}),
      ...(input.note !== undefined
        ? { note: input.note?.trim() ? input.note.trim() : null }
        : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)));

  return getTransactionById(userId, transactionId);
}

export async function deleteTransaction(
  userId: string,
  transactionId: string,
): Promise<boolean> {
  await ensureDatabaseReady();
  const result = await db
    .delete(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)));
  return Number(result.rowsAffected ?? 0) > 0;
}

/* ------------------------------------------------------------------ */
/* Ringkasan / beranda                                                 */
/* ------------------------------------------------------------------ */

export async function getSummary(userId: string): Promise<SummaryDTO> {
  await ensureDatabaseReady();
  const now = todayISO();
  const monthRange = resolveRange("month", now);

  const allTotals = await db
    .select({
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.type);

  const monthTotals = await db
    .select({
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, monthRange.start),
        lte(transactions.date, monthRange.end),
      ),
    )
    .groupBy(transactions.type);

  let income = 0;
  let expense = 0;
  let transactionCount = 0;
  for (const row of allTotals) {
    transactionCount += Number(row.count);
    if (row.type === "income") income += Number(row.total);
    else expense += Number(row.total);
  }

  let monthIncome = 0;
  let monthExpense = 0;
  for (const row of monthTotals) {
    if (row.type === "income") monthIncome += Number(row.total);
    else monthExpense += Number(row.total);
  }

  const key = monthKey(now);
  return {
    balance: income - expense,
    monthIncome,
    monthExpense,
    monthNet: monthIncome - monthExpense,
    month: key,
    monthLabel: monthLabel(key),
    transactionCount,
  };
}

/* ------------------------------------------------------------------ */
/* Kategori                                                            */
/* ------------------------------------------------------------------ */

export async function getCategories(userId: string): Promise<CategoryDTO[]> {
  await ensureDatabaseReady();
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
      icon: categories.icon,
      color: categories.color,
      isDefault: categories.isDefault,
      createdAt: categories.createdAt,
    })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.type), asc(categories.createdAt));

  const usage = await db
    .select({
      categoryId: transactions.categoryId,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.categoryId);

  const usageMap = new Map(usage.map((row) => [row.categoryId, Number(row.count)]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: (row.type === "income" ? "income" : "expense") as TxType,
    icon: row.icon,
    color: row.color,
    isDefault: row.isDefault,
    transactionCount: usageMap.get(row.id) ?? 0,
  }));
}

export async function getCategoryById(
  userId: string,
  categoryId: string,
): Promise<CategoryDTO | null> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, categoryId)));
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type === "income" ? "income" : "expense",
    icon: row.icon,
    color: row.color,
    isDefault: row.isDefault,
  };
}

/* ------------------------------------------------------------------ */
/* Target tabungan                                                     */
/* ------------------------------------------------------------------ */

export async function getGoals(userId: string): Promise<GoalDTO[]> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(desc(goals.createdAt));

  return rows.map((row) => {
    const progress =
      row.targetAmount > 0
        ? Math.min(100, Math.round((row.savedAmount / row.targetAmount) * 100))
        : 0;
    return {
      id: row.id,
      name: row.name,
      targetAmount: row.targetAmount,
      savedAmount: row.savedAmount,
      deadline: row.deadline,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      progress,
      remaining: Math.max(0, row.targetAmount - row.savedAmount),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Batas belanja bulanan                                               */
/* ------------------------------------------------------------------ */

export async function getBudget(
  userId: string,
  period = monthKey(todayISO()),
): Promise<BudgetDTO | null> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.period, period)));

  const row = rows.find((candidate) => candidate.categoryId === null) ?? rows[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    categoryId: row.categoryId,
    limitAmount: row.limitAmount,
    period: row.period,
  };
}

export async function getBudgetUsage(
  userId: string,
  period = monthKey(todayISO()),
): Promise<BudgetUsageDTO> {
  await ensureDatabaseReady();
  const budget = await getBudget(userId, period);
  const month = resolveRange("month", `${period}-01`);

  const clauses: SQL[] = [
    eq(transactions.userId, userId),
    eq(transactions.type, "expense"),
    gte(transactions.date, month.start),
    lte(transactions.date, month.end),
  ];
  if (budget?.categoryId) {
    clauses.push(eq(transactions.categoryId, budget.categoryId));
  }

  const spentRows = await db
    .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(...clauses));

  const spent = Number(spentRows[0]?.total ?? 0);
  const limit = budget?.limitAmount ?? 0;
  const percent = limit > 0 ? Math.min(999, Math.round((spent / limit) * 100)) : 0;
  const status: BudgetUsageDTO["status"] = !budget
    ? "none"
    : percent >= 100
      ? "over"
      : percent >= 80
        ? "warning"
        : "safe";

  return {
    budget,
    spent,
    remaining: budget ? limit - spent : 0,
    percent,
    status,
    period,
    periodLabel: monthLabel(period),
  };
}

/* ------------------------------------------------------------------ */
/* Pengingat                                                           */
/* ------------------------------------------------------------------ */

export async function getReminder(userId: string): Promise<ReminderDTO> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, userId))
    .orderBy(asc(reminders.createdAt));
  const row = rows[0];

  if (!row) {
    return {
      id: null,
      time: "20:00",
      days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      isActive: true,
      budgetAlertEnabled: true,
    };
  }

  return {
    id: row.id,
    time: row.time,
    days: row.days.split(",").filter(Boolean),
    isActive: row.isActive,
    budgetAlertEnabled: row.budgetAlertEnabled,
  };
}

/* ------------------------------------------------------------------ */
/* Gabungan untuk beranda                                              */
/* ------------------------------------------------------------------ */

export async function getDashboardData(userId: string) {
  await ensureDatabaseReady();
  const summary = await getSummary(userId);
  return {
    summary,
    recent: await getRecentTransactions(userId, 6),
    budgetUsage: await getBudgetUsage(userId),
    goals: (await getGoals(userId)).slice(0, 2),
  };
}
