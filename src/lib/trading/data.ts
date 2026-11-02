/**
 * Akses database modul Trading (server-side saja).
 * Semua nominal & harga dalam SEN — lihat src/lib/trading/types.ts.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import {
  paperOrders,
  priceAlerts,
  tradePlans,
  tradingSettings,
  watchlistItems,
  type PaperOrderRow,
  type PriceAlertRow,
  type TradePlanRow,
  type TradingSettingsRow,
  type WatchlistItemRow,
} from "@/lib/db/schema";
import { getEtParts } from "./market-clock";
import { findUniverseSymbol } from "./universe";
import type {
  AlertDTO,
  AlertKind,
  MarketStatus,
  OrderDTO,
  PlanStatus,
  RiskCheckItem,
  SizeResult,
  TradePlanDTO,
  TradingSettings,
  WatchlistItemDTO,
} from "./types";

export const DEFAULT_TRADING_SETTINGS: Omit<TradingSettingsRow, "userId" | "createdAt" | "updatedAt"> = {
  mode: "paper",
  budget: 500_000,
  maxLossPerTrade: 5_000,
  maxPosition: 200_000,
  maxOrder: 150_000,
  cashBuffer: 50_000,
  maxTradesPerDay: 3,
  dailyLossLimit: 15_000,
  entryFrom: "09:45",
  entryTo: "15:30",
  flatBy: "15:55",
  minRewardRisk: 1,
  universe: "sp100",
};

/* ------------------------------------------------------------------ */
/* Pengaturan                                                          */
/* ------------------------------------------------------------------ */

export async function ensureTradingSettings(userId: string): Promise<TradingSettingsRow> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(tradingSettings)
    .where(eq(tradingSettings.userId, userId));
  const existing = rows[0];
  if (existing) return existing;

  const now = new Date().toISOString();
  const row: TradingSettingsRow = {
    ...DEFAULT_TRADING_SETTINGS,
    userId,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.insert(tradingSettings).values(row);
  } catch {
    // Balapan dua request pertama: baca ulang.
    const retry = await db
      .select()
      .from(tradingSettings)
      .where(eq(tradingSettings.userId, userId));
    if (retry[0]) return retry[0];
    throw new Error("Gagal menyiapkan pengaturan trading.");
  }
  return row;
}

export function toTradingSettingsDTO(row: TradingSettingsRow): TradingSettings {
  return {
    mode: "paper",
    budget: row.budget,
    maxLossPerTrade: row.maxLossPerTrade,
    maxPosition: row.maxPosition,
    maxOrder: row.maxOrder,
    cashBuffer: row.cashBuffer,
    maxTradesPerDay: row.maxTradesPerDay,
    dailyLossLimit: row.dailyLossLimit,
    entryFrom: row.entryFrom,
    entryTo: row.entryTo,
    flatBy: row.flatBy,
    minRewardRisk: row.minRewardRisk,
    universe: row.universe,
    updatedAt: row.updatedAt,
  };
}

export async function getTradingSettings(userId: string): Promise<TradingSettings> {
  return toTradingSettingsDTO(await ensureTradingSettings(userId));
}

export async function updateTradingSettings(
  userId: string,
  patch: Partial<TradingSettings>,
): Promise<TradingSettings> {
  await ensureTradingSettings(userId);
  const clean: Record<string, unknown> = {};
  const numberKeys = [
    "budget",
    "maxLossPerTrade",
    "maxPosition",
    "maxOrder",
    "cashBuffer",
    "dailyLossLimit",
  ] as const;
  for (const key of numberKeys) {
    const value = patch[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      clean[key] = Math.round(value);
    }
  }
  if (typeof patch.maxTradesPerDay === "number" && Number.isFinite(patch.maxTradesPerDay)) {
    clean.maxTradesPerDay = Math.min(20, Math.max(1, Math.round(patch.maxTradesPerDay)));
  }
  if (typeof patch.minRewardRisk === "number" && Number.isFinite(patch.minRewardRisk)) {
    clean.minRewardRisk = Math.min(10, Math.max(0, patch.minRewardRisk));
  }
  for (const key of ["entryFrom", "entryTo", "flatBy"] as const) {
    const value = patch[key];
    if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) clean[key] = value;
  }
  if (patch.universe === "sp100" || patch.universe === "mega") clean.universe = patch.universe;

  if (Object.keys(clean).length) {
    await db
      .update(tradingSettings)
      .set({ ...clean, updatedAt: new Date().toISOString() })
      .where(eq(tradingSettings.userId, userId));
  }
  return getTradingSettings(userId);
}

/* ------------------------------------------------------------------ */
/* Watchlist                                                           */
/* ------------------------------------------------------------------ */

function toWatchlistDTO(row: WatchlistItemRow): WatchlistItemDTO {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name ?? findUniverseSymbol(row.symbol)?.name ?? row.symbol,
    source: row.source,
    note: row.note,
    createdAt: row.createdAt,
  };
}

export async function listWatchlist(userId: string): Promise<WatchlistItemDTO[]> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(watchlistItems)
    .where(eq(watchlistItems.userId, userId))
    .orderBy(desc(watchlistItems.createdAt));
  return rows.map(toWatchlistDTO);
}

export async function addWatchlistItem(
  userId: string,
  symbol: string,
  options: { name?: string | null; source?: "manual" | "scan"; note?: string | null } = {},
): Promise<WatchlistItemDTO> {
  await ensureDatabaseReady();
  const clean = symbol.trim().toUpperCase();
  const now = new Date().toISOString();
  await db
    .insert(watchlistItems)
    .values({
      id: crypto.randomUUID(),
      userId,
      symbol: clean,
      name: options.name ?? findUniverseSymbol(clean)?.name ?? null,
      source: options.source ?? "manual",
      note: options.note ?? null,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [watchlistItems.userId, watchlistItems.symbol],
      set: { name: options.name ?? findUniverseSymbol(clean)?.name ?? null },
    });
  const rows = await db
    .select()
    .from(watchlistItems)
    .where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.symbol, clean)));
  const row = rows[0];
  if (!row) throw new Error("Gagal menambahkan simbol ke watchlist.");
  return toWatchlistDTO(row);
}

export async function removeWatchlistItem(userId: string, symbol: string): Promise<void> {
  await ensureDatabaseReady();
  await db
    .delete(watchlistItems)
    .where(
      and(
        eq(watchlistItems.userId, userId),
        eq(watchlistItems.symbol, symbol.trim().toUpperCase()),
      ),
    );
}

export async function watchlistSymbols(userId: string): Promise<string[]> {
  const items = await listWatchlist(userId);
  return items.map((item) => item.symbol);
}

/* ------------------------------------------------------------------ */
/* Rencana trading                                                     */
/* ------------------------------------------------------------------ */

export interface PlanRowInput {
  symbol: string;
  setupType: TradePlanRow["setupType"];
  status?: PlanStatus;
  entryTrigger: number;
  entry?: number | null;
  stop: number;
  target: number;
  stopRule: string;
  targetRule: string;
  rMultiple: number;
  riskPerShare: number;
  riskAmount: number;
  qty: number;
  orHigh?: number | null;
  orLow?: number | null;
  orMinutes?: number | null;
  flatBy: string;
  checks: RiskCheckItem[];
  size: SizeResult;
  note?: string | null;
}

function parseChecks(raw: string): RiskCheckItem[] {
  try {
    const parsed = JSON.parse(raw) as RiskCheckItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toPlanDTO(row: TradePlanRow): TradePlanDTO {
  const entry = row.entry ?? row.entryTrigger;
  const checks = parseChecks(row.checksJson);
  return {
    id: row.id,
    symbol: row.symbol,
    setupType: row.setupType,
    status: row.status,
    entry,
    stop: row.stop,
    target: row.target,
    stopRuleLabel: row.stopRule,
    targetRuleLabel: row.targetRule,
    riskPerShare: row.riskPerShare,
    rewardPerShare: Math.max(0, row.target - entry),
    rewardRisk: row.riskPerShare > 0 ? (row.target - entry) / row.riskPerShare : 0,
    rMultiple: row.rMultiple,
    orHigh: row.orHigh,
    orLow: row.orLow,
    flatBy: row.flatBy,
    size: {
      qty: row.qty,
      limitedBy: "none",
      riskAmount: row.riskAmount,
      notional: row.qty * entry,
      cashAfter: 0,
    },
    checks,
    ok: checks.every((check) => check.status !== "fail"),
    errors: [],
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createPlan(userId: string, input: PlanRowInput): Promise<TradePlanDTO> {
  await ensureDatabaseReady();
  const now = new Date().toISOString();
  const row: TradePlanRow = {
    id: crypto.randomUUID(),
    userId,
    symbol: input.symbol.trim().toUpperCase(),
    setupType: input.setupType,
    status: input.status ?? "active",
    entryTrigger: input.entryTrigger,
    entry: input.entry ?? null,
    stop: input.stop,
    target: input.target,
    stopRule: input.stopRule,
    targetRule: input.targetRule,
    rMultiple: input.rMultiple,
    riskPerShare: input.riskPerShare,
    riskAmount: input.riskAmount,
    qty: input.qty,
    orHigh: input.orHigh ?? null,
    orLow: input.orLow ?? null,
    orMinutes: input.orMinutes ?? null,
    flatBy: input.flatBy,
    checksJson: JSON.stringify(input.checks),
    note: input.note ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(tradePlans).values(row);
  return toPlanDTO(row);
}

export async function listPlans(
  userId: string,
  statuses?: PlanStatus[],
): Promise<TradePlanDTO[]> {
  await ensureDatabaseReady();
  const where = statuses?.length
    ? and(eq(tradePlans.userId, userId), inArray(tradePlans.status, statuses))
    : eq(tradePlans.userId, userId);
  const rows = await db
    .select()
    .from(tradePlans)
    .where(where)
    .orderBy(desc(tradePlans.createdAt))
    .limit(50);
  return rows.map(toPlanDTO);
}

export async function getPlan(userId: string, id: string): Promise<TradePlanDTO | null> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(tradePlans)
    .where(and(eq(tradePlans.userId, userId), eq(tradePlans.id, id)));
  return rows[0] ? toPlanDTO(rows[0]) : null;
}

export async function updatePlan(
  userId: string,
  id: string,
  patch: { status?: PlanStatus; note?: string | null; entry?: number | null },
): Promise<TradePlanDTO | null> {
  await ensureDatabaseReady();
  const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.status) clean.status = patch.status;
  if (patch.note !== undefined) clean.note = patch.note;
  if (patch.entry !== undefined) clean.entry = patch.entry;
  await db
    .update(tradePlans)
    .set(clean)
    .where(and(eq(tradePlans.userId, userId), eq(tradePlans.id, id)));
  return getPlan(userId, id);
}

export async function deletePlan(userId: string, id: string): Promise<void> {
  await ensureDatabaseReady();
  await db.delete(tradePlans).where(and(eq(tradePlans.userId, userId), eq(tradePlans.id, id)));
}

/* ------------------------------------------------------------------ */
/* Order kertas                                                        */
/* ------------------------------------------------------------------ */

function toOrderDTO(row: PaperOrderRow): OrderDTO {
  return {
    id: row.id,
    planId: row.planId,
    symbol: row.symbol,
    qty: row.qty,
    entry: row.entry,
    stop: row.stop,
    target: row.target,
    status: row.status,
    filledAt: row.filledAt,
    filledPrice: row.filledPrice,
    closedAt: row.closedAt,
    closedPrice: row.closedPrice,
    exitReason: row.exitReason ?? null,
    riskAmount: row.riskAmount,
    pnl: row.pnl,
    createdAt: row.createdAt,
  };
}

export async function createOrder(
  userId: string,
  input: {
    planId?: string | null;
    symbol: string;
    qty: number;
    entry: number;
    stop: number;
    target: number;
    riskAmount: number;
  },
): Promise<OrderDTO> {
  await ensureDatabaseReady();
  const now = new Date().toISOString();
  const row: PaperOrderRow = {
    id: crypto.randomUUID(),
    userId,
    planId: input.planId ?? null,
    symbol: input.symbol.trim().toUpperCase(),
    side: "long",
    orderType: "bracket",
    qty: input.qty,
    entry: input.entry,
    stop: input.stop,
    target: input.target,
    status: "pending",
    filledAt: null,
    filledPrice: null,
    closedAt: null,
    closedPrice: null,
    exitReason: null,
    riskAmount: input.riskAmount,
    pnl: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(paperOrders).values(row);
  return toOrderDTO(row);
}

export async function listOrders(userId: string, limit = 30): Promise<OrderDTO[]> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(paperOrders)
    .where(eq(paperOrders.userId, userId))
    .orderBy(desc(paperOrders.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.map(toOrderDTO);
}

export async function getOrder(userId: string, id: string): Promise<OrderDTO | null> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(paperOrders)
    .where(and(eq(paperOrders.userId, userId), eq(paperOrders.id, id)));
  return rows[0] ? toOrderDTO(rows[0]) : null;
}

export async function updateOrder(
  userId: string,
  id: string,
  patch: {
    status?: PaperOrderRow["status"];
    filledAt?: string | null;
    filledPrice?: number | null;
    closedAt?: string | null;
    closedPrice?: number | null;
    exitReason?: PaperOrderRow["exitReason"];
    pnl?: number | null;
  },
): Promise<OrderDTO | null> {
  await ensureDatabaseReady();
  const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) clean[key] = value;
  }
  await db
    .update(paperOrders)
    .set(clean)
    .where(and(eq(paperOrders.userId, userId), eq(paperOrders.id, id)));
  return getOrder(userId, id);
}

/* ------------------------------------------------------------------ */
/* Alert harga                                                         */
/* ------------------------------------------------------------------ */

function toAlertDTO(row: PriceAlertRow): AlertDTO {
  return {
    id: row.id,
    symbol: row.symbol,
    kind: row.kind,
    level: row.level,
    pct: row.pct,
    label: row.label,
    isActive: row.isActive,
    triggeredAt: row.triggeredAt,
    createdAt: row.createdAt,
  };
}

export async function listAlerts(userId: string): Promise<AlertDTO[]> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(priceAlerts)
    .where(eq(priceAlerts.userId, userId))
    .orderBy(desc(priceAlerts.createdAt))
    .limit(50);
  return rows.map(toAlertDTO);
}

export async function createAlert(
  userId: string,
  input: { symbol: string; kind: AlertKind; level?: number | null; pct?: number | null; label: string },
): Promise<AlertDTO> {
  await ensureDatabaseReady();
  const row: PriceAlertRow = {
    id: crypto.randomUUID(),
    userId,
    symbol: input.symbol.trim().toUpperCase(),
    kind: input.kind,
    level: input.level ?? null,
    pct: input.pct ?? null,
    label: input.label,
    isActive: true,
    triggeredAt: null,
    createdAt: new Date().toISOString(),
  };
  await db.insert(priceAlerts).values(row);
  return toAlertDTO(row);
}

export async function updateAlert(
  userId: string,
  id: string,
  patch: { isActive?: boolean; triggeredAt?: string | null },
): Promise<AlertDTO | null> {
  await ensureDatabaseReady();
  const clean: Record<string, unknown> = {};
  if (patch.isActive !== undefined) clean.isActive = patch.isActive;
  if (patch.triggeredAt !== undefined) clean.triggeredAt = patch.triggeredAt;
  if (Object.keys(clean).length) {
    await db
      .update(priceAlerts)
      .set(clean)
      .where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.id, id)));
  }
  const rows = await db
    .select()
    .from(priceAlerts)
    .where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.id, id)));
  return rows[0] ? toAlertDTO(rows[0]) : null;
}

export async function deleteAlert(userId: string, id: string): Promise<void> {
  await ensureDatabaseReady();
  await db.delete(priceAlerts).where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.id, id)));
}

/* ------------------------------------------------------------------ */
/* Statistik & anggaran risiko                                         */
/* ------------------------------------------------------------------ */

export interface TradingStats {
  tradesToday: number;
  riskToday: number;
  realizedPnlToday: number;
  openRisk: number;
  openPositions: number;
  pendingOrders: number;
  paperEquity: number;
}

function etDateOfIso(iso: string): string {
  return getEtParts(new Date(iso)).dateISO;
}

export async function getTradingStats(
  userId: string,
  settings: TradingSettings,
): Promise<TradingStats> {
  await ensureDatabaseReady();
  const today = getEtParts().dateISO;
  const orders = await listOrders(userId, 200);

  let tradesToday = 0;
  let riskToday = 0;
  let realizedPnlToday = 0;
  let openRisk = 0;
  let openPositions = 0;
  let pendingOrders = 0;

  for (const order of orders) {
    // Yang dihitung sebagai "trade hari ini" hanya order yang benar-benar
    // diisi/ditutup. Order yang dibatalkan tidak memakai jatah trade.
    const isTrade = order.status === "filled" || order.status === "closed";
    if (isTrade && etDateOfIso(order.createdAt) === today) {
      tradesToday += 1;
      riskToday += order.riskAmount;
    }
    if (order.status === "filled") {
      openPositions += 1;
      openRisk += order.riskAmount;
    }
    if (order.status === "pending") pendingOrders += 1;
    if (order.status === "closed" && order.closedAt && etDateOfIso(order.closedAt) === today) {
      realizedPnlToday += order.pnl ?? 0;
    }
  }

  const paperEquity =
    settings.budget + orders.reduce((sum, order) => sum + (order.pnl ?? 0), 0);

  return {
    tradesToday,
    riskToday,
    realizedPnlToday,
    openRisk,
    openPositions,
    pendingOrders,
    paperEquity,
  };
}

/** Ringkasan status pasar + pengaturan untuk dashboard & header. */
export function buildDeskHeader(market: MarketStatus, settings: TradingSettings) {
  return { market, settings };
}

/** SQL count helper dipakai halaman statistik ringan. */
export async function countWatchlist(userId: string): Promise<number> {
  await ensureDatabaseReady();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(watchlistItems)
    .where(eq(watchlistItems.userId, userId));
  return Number(rows[0]?.count ?? 0);
}
