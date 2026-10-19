import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Catatku — skema database (SQLite / Drizzle ORM).
 * Semua tabel data pengguna memakai `user_id` agar data terisolasi per akun.
 * Nominal uang disimpan sebagai INTEGER dalam satuan terkecil mata uang
 * (Rupiah = 1, USD = cent) supaya tidak ada galat pembulatan.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  currency: text("currency").notNull().default("IDR"),
  theme: text("theme", { enum: ["light", "dark"] })
    .notNull()
    .default("light"),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    icon: text("icon").notNull().default("ellipsis"),
    color: text("color").notNull().default("#0F7B5A"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("categories_user_type_idx").on(t.userId, t.type)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    amount: integer("amount").notNull(),
    note: text("note"),
    date: text("date").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.date),
    index("transactions_user_category_idx").on(t.userId, t.categoryId),
  ],
);

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetAmount: integer("target_amount").notNull(),
    savedAmount: integer("saved_amount").notNull().default(0),
    deadline: text("deadline"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    limitAmount: integer("limit_amount").notNull(),
    period: text("period").notNull(), // YYYY-MM
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("budgets_user_period_idx").on(t.userId, t.period)],
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    time: text("time").notNull().default("20:00"), // HH:mm
    days: text("days").notNull().default("mon,tue,wed,thu,fri,sat,sun"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    budgetAlertEnabled: integer("budget_alert_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("reminders_user_idx").on(t.userId)],
);

export type UserRow = typeof users.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type BudgetRow = typeof budgets.$inferSelect;
export type ReminderRow = typeof reminders.$inferSelect;
