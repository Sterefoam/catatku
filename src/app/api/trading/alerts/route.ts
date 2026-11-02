import { z } from "zod";
import { jsonError, jsonOk, readJson, requireApiUser, validationError } from "@/lib/api";
import { createAlert, getTradingSettings, listAlerts } from "@/lib/trading/data";
import { flatByFor, marketStatus } from "@/lib/trading/market-clock";
import { fmtPrice } from "@/lib/trading/format";
import type { AlertKind } from "@/lib/trading/types";

export const dynamic = "force-dynamic";

const ALERT_KINDS: AlertKind[] = ["above", "below", "stop", "target", "pct", "bell", "flat-by"];
const PRICE_KINDS: AlertKind[] = ["above", "below", "stop", "target"];

const alertSchema = z
  .object({
    symbol: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9.\-]{0,9}$/, "Simbol tidak valid. Contoh: TSLA.")
      .optional(),
    kind: z.enum(ALERT_KINDS as [AlertKind, ...AlertKind[]], {
      error: "Jenis alert tidak dikenal.",
    }),
    level: z
      .number({ error: "Level harga tidak valid." })
      .int("Level harga harus bilangan bulat dalam sen.")
      .positive("Level harga harus lebih dari nol.")
      .max(100_000_000, "Level harga terlalu besar.")
      .nullable()
      .optional(),
    pct: z
      .number({ error: "Persentase tidak valid." })
      .positive("Persentase harus lebih dari nol.")
      .max(100, "Persentase maksimal 100.")
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (PRICE_KINDS.includes(value.kind) && (!value.level || value.level <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["level"],
        message: "Level harga wajib diisi untuk alert ini.",
      });
    }
    if (value.kind === "pct" && (!value.pct || value.pct <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["pct"],
        message: "Persentase wajib diisi untuk alert perubahan harga.",
      });
    }
  });

/** Label Indonesia otomatis sesuai jenis alert. */
function buildLabel(input: {
  symbol: string;
  kind: AlertKind;
  level: number | null;
  pct: number | null;
  flatBy: string;
}): string {
  const { symbol, kind, level, pct, flatBy } = input;
  switch (kind) {
    case "above":
      return `${symbol} di atas ${fmtPrice(level ?? 0)}`;
    case "below":
      return `${symbol} di bawah ${fmtPrice(level ?? 0)}`;
    case "stop":
      return `${symbol} kena stop di ${fmtPrice(level ?? 0)}`;
    case "target":
      return `${symbol} capai target ${fmtPrice(level ?? 0)}`;
    case "pct":
      return `${symbol} bergerak ${String(pct ?? 0).replace(".", ",")}% dari penutupan sebelumnya`;
    case "bell":
      return "Bel pembukaan NYSE";
    case "flat-by":
      return `Waktunya flat by ${flatBy} ET`;
    default:
      return `${symbol} alert`;
  }
}

/** GET /api/trading/alerts — semua alert pengguna (aktif & sudah terpicu). */
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const alerts = await listAlerts(auth.user.id);
  return jsonOk({ alerts });
}

/** POST /api/trading/alerts — buat alert harga dengan label otomatis. */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const parsed = alertSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { kind, level, pct } = parsed.data;
  const symbol = parsed.data.symbol ?? "MARKET";
  if (!parsed.data.symbol && (PRICE_KINDS.includes(kind) || kind === "pct")) {
    return jsonError("Simbol saham wajib diisi untuk alert ini.", 422);
  }

  const settings = await getTradingSettings(auth.user.id);
  const market = marketStatus();
  const flatBy = kind === "flat-by" ? flatByFor(market.sessionDate, settings.flatBy) : settings.flatBy;

  const alert = await createAlert(auth.user.id, {
    symbol,
    kind,
    level: PRICE_KINDS.includes(kind) ? (level ?? null) : null,
    pct: kind === "pct" ? (pct ?? null) : null,
    label: buildLabel({
      symbol,
      kind,
      level: PRICE_KINDS.includes(kind) ? (level ?? null) : null,
      pct: pct ?? null,
      flatBy,
    }),
  });

  return jsonOk({ alert }, 201);
}
