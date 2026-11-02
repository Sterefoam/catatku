import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/**
 * Transaksi yang masuk otomatis (dari email BCA atau impor mutasi) dan
 * menunggu konfirmasi pengguna sebelum dicatat sebagai transaksi final.
 */
export const pendingTransactions = sqliteTable(
  "pending_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source", { enum: ["email", "statement"] }).notNull(),
    externalId: text("external_id").notNull(),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    amount: integer("amount").notNull(),
    note: text("note"),
    date: text("date").notNull(),
    rawSubject: text("raw_subject"),
    rawFrom: text("raw_from"),
    confidence: text("confidence", { enum: ["high", "low"] }),
    status: text("status", { enum: ["pending", "confirmed", "ignored"] })
      .notNull()
      .default("pending"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("pending_user_external_idx").on(t.userId, t.externalId),
    index("pending_user_status_idx").on(t.userId, t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Meja Trading                                                        */
/* Semua harga & nominal uang di tabel trading memakai SEN (integer).  */
/* ------------------------------------------------------------------ */

export const tradingSettings = sqliteTable("trading_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  mode: text("mode", { enum: ["paper"] })
    .notNull()
    .default("paper"),
  budget: integer("budget").notNull().default(500_000),
  maxLossPerTrade: integer("max_loss_per_trade").notNull().default(5_000),
  maxPosition: integer("max_position").notNull().default(200_000),
  maxOrder: integer("max_order").notNull().default(150_000),
  cashBuffer: integer("cash_buffer").notNull().default(50_000),
  maxTradesPerDay: integer("max_trades_per_day").notNull().default(3),
  dailyLossLimit: integer("daily_loss_limit").notNull().default(15_000),
  entryFrom: text("entry_from").notNull().default("09:45"),
  entryTo: text("entry_to").notNull().default("15:30"),
  flatBy: text("flat_by").notNull().default("15:55"),
  minRewardRisk: real("min_reward_risk").notNull().default(1),
  universe: text("universe").notNull().default("sp100"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const watchlistItems = sqliteTable(
  "watchlist_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    name: text("name"),
    source: text("source", { enum: ["manual", "scan"] })
      .notNull()
      .default("manual"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("watchlist_user_symbol_idx").on(t.userId, t.symbol),
    index("watchlist_user_idx").on(t.userId),
  ],
);

export const tradePlans = sqliteTable(
  "trade_plans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    setupType: text("setup_type", { enum: ["orb", "level", "breakout20", "flag"] }).notNull(),
    status: text("status", { enum: ["draft", "active", "triggered", "done", "cancelled"] })
      .notNull()
      .default("draft"),
    entryTrigger: integer("entry_trigger").notNull(),
    entry: integer("entry"),
    stop: integer("stop").notNull(),
    target: integer("target").notNull(),
    stopRule: text("stop_rule").notNull(),
    targetRule: text("target_rule").notNull(),
    rMultiple: real("r_multiple").notNull().default(2),
    riskPerShare: integer("risk_per_share").notNull(),
    riskAmount: integer("risk_amount").notNull(),
    qty: integer("qty").notNull(),
    orHigh: integer("or_high"),
    orLow: integer("or_low"),
    orMinutes: integer("or_minutes"),
    flatBy: text("flat_by").notNull().default("15:55"),
    checksJson: text("checks_json").notNull().default("[]"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("trade_plans_user_status_idx").on(t.userId, t.status)],
);

export const paperOrders = sqliteTable(
  "paper_orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id").references(() => tradePlans.id, { onDelete: "set null" }),
    symbol: text("symbol").notNull(),
    side: text("side", { enum: ["long"] })
      .notNull()
      .default("long"),
    orderType: text("order_type").notNull().default("bracket"),
    qty: integer("qty").notNull(),
    entry: integer("entry").notNull(),
    stop: integer("stop").notNull(),
    target: integer("target").notNull(),
    status: text("status", { enum: ["pending", "filled", "closed", "cancelled"] })
      .notNull()
      .default("pending"),
    filledAt: text("filled_at"),
    filledPrice: integer("filled_price"),
    closedAt: text("closed_at"),
    closedPrice: integer("closed_price"),
    exitReason: text("exit_reason", { enum: ["target", "stop", "flat-by", "manual"] }),
    riskAmount: integer("risk_amount").notNull().default(0),
    pnl: integer("pnl"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("paper_orders_user_status_idx").on(t.userId, t.status)],
);

export const priceAlerts = sqliteTable(
  "price_alerts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    kind: text("kind", { enum: ["above", "below", "stop", "target", "pct", "bell", "flat-by"] })
      .notNull(),
    level: integer("level"),
    pct: real("pct"),
    label: text("label").notNull().default(""),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    triggeredAt: text("triggered_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("price_alerts_user_active_idx").on(t.userId, t.isActive)],
);

export type UserRow = typeof users.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type BudgetRow = typeof budgets.$inferSelect;
export type ReminderRow = typeof reminders.$inferSelect;
export type TradingSettingsRow = typeof tradingSettings.$inferSelect;
export type WatchlistItemRow = typeof watchlistItems.$inferSelect;
export type TradePlanRow = typeof tradePlans.$inferSelect;
export type PaperOrderRow = typeof paperOrders.$inferSelect;
export type PriceAlertRow = typeof priceAlerts.$inferSelect;
