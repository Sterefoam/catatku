import { z } from "zod";
import { jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import {
  getTradingSettings,
  getTradingStats,
  updateTradingSettings,
} from "@/lib/trading/data";
import { marketStatus } from "@/lib/trading/market-clock";
import type { TradingSettings } from "@/lib/trading/types";

export const dynamic = "force-dynamic";

const settingsSchema = z
  .object({
    budget: z.number({ error: "Modal belum diisi." }).int("Modal harus bilangan bulat.").min(0, "Modal tidak boleh negatif.").max(1_000_000_000, "Modal terlalu besar.").optional(),
    maxLossPerTrade: z.number({ error: "Batas rugi belum diisi." }).int("Batas rugi harus bilangan bulat.").min(0, "Batas rugi tidak boleh negatif.").max(100_000_000, "Batas rugi terlalu besar.").optional(),
    maxPosition: z.number({ error: "Ukuran posisi belum diisi." }).int("Ukuran posisi harus bilangan bulat.").min(0, "Ukuran posisi tidak boleh negatif.").max(1_000_000_000, "Ukuran posisi terlalu besar.").optional(),
    maxOrder: z.number({ error: "Nilai order belum diisi." }).int("Nilai order harus bilangan bulat.").min(0, "Nilai order tidak boleh negatif.").max(1_000_000_000, "Nilai order terlalu besar.").optional(),
    cashBuffer: z.number({ error: "Kas disisakan belum diisi." }).int("Kas disisakan harus bilangan bulat.").min(0, "Kas disisakan tidak boleh negatif.").max(1_000_000_000, "Kas disisakan terlalu besar.").optional(),
    maxTradesPerDay: z.number({ error: "Jumlah trade belum diisi." }).int("Jumlah trade harus bilangan bulat.").min(1, "Minimal 1 trade per hari.").max(20, "Maksimal 20 trade per hari.").optional(),
    dailyLossLimit: z.number({ error: "Batas rugi harian belum diisi." }).int("Batas rugi harian harus bilangan bulat.").min(0, "Batas rugi harian tidak boleh negatif.").max(1_000_000_000, "Batas rugi harian terlalu besar.").optional(),
    entryFrom: z.string().regex(/^\d{2}:\d{2}$/, "Jam masuk harus berformat HH:mm.").optional(),
    entryTo: z.string().regex(/^\d{2}:\d{2}$/, "Jam masuk selesai harus berformat HH:mm.").optional(),
    flatBy: z.string().regex(/^\d{2}:\d{2}$/, "Jam keluar harus berformat HH:mm.").optional(),
    minRewardRisk: z.number({ error: "Imbalan : risiko belum diisi." }).min(0, "Imbalan : risiko tidak boleh negatif.").max(10, "Imbalan : risiko maksimal 10.").optional(),
    universe: z.enum(["sp100", "mega"], { error: "Pilihan daftar saham tidak dikenal." }).optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const settings = await getTradingSettings(auth.user.id);
  const stats = await getTradingStats(auth.user.id, settings);
  return jsonOk({ settings, stats, market: marketStatus() });
}

export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const patch = parsed.data as Partial<TradingSettings>;
  const settings = await updateTradingSettings(auth.user.id, patch);
  const stats = await getTradingStats(auth.user.id, settings);
  return jsonOk({ settings, stats });
}
