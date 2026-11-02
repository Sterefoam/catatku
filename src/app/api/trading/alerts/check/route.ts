import { jsonOk, requireApiUser } from "@/lib/api";
import { getTradingSettings, listAlerts, updateAlert } from "@/lib/trading/data";
import { flatByFor, getEtParts, hhmmToMinutes, marketStatus } from "@/lib/trading/market-clock";
import { fetchQuotes } from "@/lib/trading/yahoo";
import type { AlertDTO, AlertKind } from "@/lib/trading/types";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 30;

const PRICE_KINDS: AlertKind[] = ["above", "below", "stop", "target"];

/**
 * POST /api/trading/alerts/check
 * Cek semua alert aktif terhadap harga terakhir & jam ET. Alert yang terpicu
 * ditandai `triggeredAt` dan dinonaktifkan (`isActive = false`) supaya hanya
 * berbunyi sekali. Respons: { triggered, checkedAt, prices }.
 */
export async function POST() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const settings = await getTradingSettings(auth.user.id);
  const alerts = (await listAlerts(auth.user.id)).filter((alert) => alert.isActive);
  const market = marketStatus();
  const parts = getEtParts();
  const flatBy = flatByFor(parts.dateISO, settings.flatBy);
  const flatByMinutes = hhmmToMinutes(flatBy);
  const afterHoursEndMinutes = 20 * 60;
  const nowIso = new Date().toISOString();

  // Hanya alert berbasis harga yang perlu quote.
  const symbols = Array.from(
    new Set(
      alerts
        .filter((alert) => alert.kind !== "bell" && alert.kind !== "flat-by")
        .map((alert) => alert.symbol)
        .filter(Boolean),
    ),
  );
  const quotes = symbols.length
    ? await fetchQuotes(symbols).catch(() => new Map())
    : new Map();

  const prices: Record<string, number> = {};
  for (const [symbol, quote] of quotes) prices[symbol] = quote.price;

  const triggered: AlertDTO[] = [];
  for (const alert of alerts) {
    const quote = quotes.get(alert.symbol) ?? null;
    let hit = false;

    switch (alert.kind) {
      case "bell":
        hit = market.state === "open" && !alert.triggeredAt;
        break;
      case "flat-by":
        // Berbunyi sekali pada hari bursa saat jam ET melewati batas flat by,
        // tetap dihitung selama jam pasca-pasar (bukan tengah malam).
        hit =
          market.isTradingDay &&
          parts.minutes >= flatByMinutes &&
          parts.minutes < afterHoursEndMinutes;
        break;
      case "above":
        hit = Boolean(quote && alert.level !== null && quote.price >= alert.level);
        break;
      case "below":
      case "stop":
        hit = Boolean(quote && alert.level !== null && quote.price <= alert.level);
        break;
      case "target":
        hit = Boolean(quote && alert.level !== null && quote.price >= alert.level);
        break;
      case "pct":
        hit = Boolean(
          quote && alert.pct !== null && Math.abs(quote.changePct) >= alert.pct,
        );
        break;
      default:
        hit = false;
    }

    if (!hit) continue;
    const updated = await updateAlert(auth.user.id, alert.id, {
      isActive: false,
      triggeredAt: nowIso,
    });
    if (updated) triggered.push(updated);
  }

  return jsonOk({ triggered, checkedAt: nowIso, prices });
}
