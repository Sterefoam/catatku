import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { simulatePlan } from "@/lib/trading/timemachine";
import { fetchChart } from "@/lib/trading/yahoo";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 60;

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

const timeMachineSchema = z
  .object({
    symbol: z
      .string({ error: "Simbol saham wajib diisi." })
      .trim()
      .min(1, "Simbol saham wajib diisi.")
      .max(12, "Simbol saham terlalu panjang."),
    entry: z
      .number({ error: "Harga entry wajib diisi." })
      .int("Harga entry harus bilangan bulat dalam sen.")
      .positive("Harga entry harus lebih dari 0."),
    stop: z
      .number({ error: "Harga stop wajib diisi." })
      .int("Harga stop harus bilangan bulat dalam sen.")
      .positive("Harga stop harus lebih dari 0."),
    target: z
      .number({ error: "Harga target wajib diisi." })
      .int("Harga target harus bilangan bulat dalam sen.")
      .positive("Harga target harus lebih dari 0."),
  })
  .refine((value) => value.stop < value.entry, {
    message: "Stop harus di bawah harga entry.",
    path: ["stop"],
  })
  .refine((value) => value.target > value.entry, {
    message: "Target harus di atas harga entry.",
    path: ["target"],
  });

/**
 * POST /api/trading/timemachine
 * Body: { symbol, entry, stop, target } — semua harga dalam SEN.
 * Respons: { sim: TimeMachineResult }
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = timeMachineSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const symbol = parsed.data.symbol.trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) {
    return jsonError("Simbol saham tidak valid.", 422, {
      symbol: "Gunakan kode saham AS, mis. TSLA atau NVDA.",
    });
  }

  // Yahoo: interval 5 menit maksimum ±60 hari. Coba "60d" dulu, lalu "1mo".
  let usedRange = "60d";
  let series = await fetchChart(symbol, "60d", "5m").catch(() => null);
  if (!series || series.bars.length < 6) {
    usedRange = "1mo";
    series = await fetchChart(symbol, "1mo", "5m").catch(() => null);
  }
  if (!series || !series.bars.length) {
    return jsonError(
      "Data bar 5 menit sedang tidak tersedia untuk simbol ini. Coba lagi sebentar.",
      503,
    );
  }

  const sim = simulatePlan({
    symbol,
    entry: parsed.data.entry,
    stop: parsed.data.stop,
    target: parsed.data.target,
    bars: series.bars,
    simulations: 2000,
  });

  // Sebutkan jendela data yang benar-benar dipakai (jangan mengklaim 60 hari bila bukan).
  sim.assumptions.unshift(
    usedRange === "60d"
      ? "Bar 5 menit ±60 hari terakhir (sekitar 60 sesi bursa) dipakai untuk bootstrap."
      : "Data 5 menit 60 hari tidak tersedia untuk simbol ini — dipakai data yang lebih pendek, jadi sampel lebih sedikit.",
  );

  return jsonOk({ sim });
}
