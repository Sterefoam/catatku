/**
 * Bagian bersama route rencana trading: skema validasi body PlanDraft dan
 * pengumpulan konteks pasar (quote, ATR, opening range, status pasar, statistik
 * risiko) yang dibutuhkan `computePlan` dari src/lib/trading/plan-engine.ts.
 *
 * Catatan kontrak: `PlanDraft` hanya punya `stopPrice`. Untuk aturan stop
 * "pct" dan "atr", route ini mengirim parameter lewat `stopPrice`:
 *   - "pct": persen × 100  (1,5% menjadi 150)
 *   - "atr": kelipatan × 100 (1,5× ATR menjadi 150)
 * Semua harga tetap dalam SEN.
 */

import { z } from "zod";
import { getTradingSettings, getTradingStats } from "@/lib/trading/data";
import { marketStatus } from "@/lib/trading/market-clock";
import { atr14, openingRange } from "@/lib/trading/technicals";
import { fetchChart, fetchQuote } from "@/lib/trading/yahoo";
import type { PlanContext } from "@/lib/trading/plan-engine";
import type { PlanDraft, TradingSettings } from "@/lib/trading/types";

const priceSchema = z
  .number({ error: "Harga belum diisi." })
  .int("Harga harus bilangan bulat dalam sen.")
  .positive("Harga harus lebih dari nol.")
  .max(100_000_000, "Harga terlalu besar.");

export const planDraftSchema = z.object({
  symbol: z
    .string({ error: "Simbol wajib diisi." })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9.\-]{0,9}$/, "Simbol tidak valid. Contoh: TSLA atau BRK.B."),
  setupType: z.enum(["orb", "level", "breakout20", "flag"], {
    error: "Jenis setup tidak dikenal.",
  }),
  entryTrigger: priceSchema,
  stopRule: z.enum(["or-mid", "or-low", "price", "pct", "atr"], {
    error: "Aturan stop tidak dikenal.",
  }),
  stopPrice: z.number({ error: "Batas rugi belum diisi." }).int("Batas rugi harus bilangan bulat.").positive("Batas rugi harus lebih dari nol.").max(100_000_000, "Batas rugi terlalu besar.").nullable().optional(),
  targetRule: z.enum(["1R", "1.5R", "2R", "price"], {
    error: "Aturan target tidak dikenal.",
  }),
  targetPrice: z.number({ error: "Target belum diisi." }).int("Target harus bilangan bulat.").positive("Target harus lebih dari nol.").max(100_000_000, "Target terlalu besar.").nullable().optional(),
  orHigh: z.number({ error: "Rentang awal tertinggi belum diisi." }).int("Rentang awal harus bilangan bulat.").positive("Rentang awal harus lebih dari nol.").max(100_000_000, "Rentang awal terlalu besar.").nullable().optional(),
  orLow: z.number({ error: "Rentang awal terendah belum diisi." }).int("Rentang awal harus bilangan bulat.").positive("Rentang awal harus lebih dari nol.").max(100_000_000, "Rentang awal terlalu besar.").nullable().optional(),
  orMinutes: z.number({ error: "Durasi rentang awal belum diisi." }).int("Durasi harus bilangan bulat.").min(5, "Durasi minimal 5 menit.").max(120, "Durasi maksimal 120 menit.").nullable().optional(),
  flatBy: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam keluar harus berformat HH:mm.")
    .nullable()
    .optional(),
  note: z.string().trim().max(400, "Catatan maksimal 400 karakter.").nullable().optional(),
});

export type PlanDraftBody = z.infer<typeof planDraftSchema>;

/** Ubah body tervalidasi menjadi PlanDraft murni untuk computePlan. */
export function toPlanDraft(input: PlanDraftBody): PlanDraft {
  return {
    symbol: input.symbol,
    setupType: input.setupType,
    entryTrigger: input.entryTrigger,
    stopRule: input.stopRule,
    stopPrice: input.stopPrice ?? null,
    targetRule: input.targetRule,
    targetPrice: input.targetPrice ?? null,
    orHigh: input.orHigh ?? null,
    orLow: input.orLow ?? null,
    orMinutes: input.orMinutes ?? 15,
    flatBy: input.flatBy ?? null,
    note: input.note ?? null,
  };
}

export interface PlanContextBundle {
  settings: TradingSettings;
  context: PlanContext;
}

/**
 * Kumpulkan konteks untuk computePlan: harga terakhir, ATR 14 harian,
 * opening range 5 menit sesi terakhir, status pasar, dan statistik risiko
 * pengguna. Fetch Yahoo yang gagal tidak melempar error — nilainya null.
 */
export async function loadPlanContext(
  userId: string,
  draft: PlanDraft,
): Promise<PlanContextBundle> {
  const minutes = draft.orMinutes ?? 15;
  const symbol = draft.symbol;

  const [quote, intraday, daily, settings] = await Promise.all([
    fetchQuote(symbol).catch(() => null),
    fetchChart(symbol, "1d", "5m").catch(() => null),
    fetchChart(symbol, "3mo", "1d").catch(() => null),
    getTradingSettings(userId),
  ]);

  const stats = await getTradingStats(userId, settings);
  const context: PlanContext = {
    quote,
    atr14: daily ? atr14(daily.bars) : null,
    openingRange: intraday ? openingRange(intraday.bars, minutes) : null,
    market: marketStatus(),
    stats,
  };
  return { settings, context };
}

/** Pesan Indonesia saat fetch data pasar gagal total. */
export const PLAN_CONTEXT_ERROR =
  "Data pasar belum lengkap (harga, ATR, atau opening range). Coba lagi sebentar atau pilih aturan stop lain.";
