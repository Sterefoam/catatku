import { jsonError, jsonOk, numberParam, requireApiUser } from "@/lib/api";
import { getTradingSettings } from "@/lib/trading/data";
import { fmtPct, fmtPrice } from "@/lib/trading/format";
import {
  closeMinutesFor,
  getEtParts,
  hhmmToMinutes,
  MARKET_OPEN_MINUTES,
  marketStatus,
  minutesToHHMM,
} from "@/lib/trading/market-clock";
import { detectOrb, isBarComplete, lastSessionBars, openingRange } from "@/lib/trading/technicals";
import type {
  CandleSeries,
  MarketStatus,
  TradingSettings,
  TriggerState,
} from "@/lib/trading/types";
import { fetchChart } from "@/lib/trading/yahoo";

export const dynamic = "force-dynamic";

// Beri waktu lebih untuk permintaan data pasar (Yahoo/SEC) di Vercel.
export const maxDuration = 30;

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

interface TriggerInput {
  symbol: string;
  setup: "orb" | "level";
  /** Level pemicu (SEN) untuk setup level. */
  level: number | null;
  /** Menit opening range (default 15). */
  minutes: number;
  series: CandleSeries | null;
  market: MarketStatus;
  settings: TradingSettings;
  nowMs: number;
}

function baseTrigger(symbol: string): TriggerState {
  return {
    status: "no-data",
    symbol,
    level: null,
    last: null,
    distancePct: null,
    barTime: null,
    price: null,
    message: "",
    openingRange: null,
  };
}

function buildTrigger(input: TriggerInput): TriggerState {
  const { symbol, setup, series, market, settings, nowMs } = input;
  const base = baseTrigger(symbol);

  if (!series || !series.bars.length) {
    return {
      ...base,
      status: "no-data",
      message: `Data 5 menit ${symbol} belum tersedia. Coba lagi sebentar.`,
    };
  }

  const sessionBars = lastSessionBars(series.bars);
  const lastBar = sessionBars[sessionBars.length - 1];
  if (!lastBar) {
    return {
      ...base,
      status: "no-data",
      message: `Belum ada bar sesi terakhir untuk ${symbol}.`,
    };
  }

  const last = lastBar.c;
  const range = openingRange(series.bars, input.minutes, nowMs);
  const level = setup === "orb" ? (range?.high ?? null) : input.level;
  const distancePct =
    level !== null && level > 0 && last > 0
      ? Math.round(((level - last) / last) * 10000) / 100
      : null;
  const withBase: TriggerState = { ...base, level, last, distancePct, openingRange: range };

  // Pasar belum buka → "not-open", bukan error.
  if (market.state === "premarket") {
    return {
      ...withBase,
      status: "not-open",
      message: `Pasar belum buka — bel pembukaan 09.30 ET belum berbunyi. ${market.detail}`,
    };
  }
  if (market.state === "closed" || market.state === "weekend" || market.state === "holiday") {
    return {
      ...withBase,
      status: "not-open",
      message: `Bursa sedang tutup. ${market.detail}`,
    };
  }

  // Saat pasar buka, pastikan bar yang dipakai memang sesi hari ini.
  const sessionDate = getEtParts(new Date((lastBar.t + 1) * 1000)).dateISO;
  const todayEt = getEtParts(new Date(nowMs)).dateISO;
  if (market.state === "open" && sessionDate !== todayEt) {
    return {
      ...withBase,
      status: "waiting",
      message: `Data 5 menit sesi hari ini belum masuk untuk ${symbol} — coba lagi beberapa menit.`,
    };
  }

  // Opening range belum lengkap (khusus ORB).
  if (setup === "orb" && (!range || !range.complete)) {
    if (market.state === "afterhours") {
      return {
        ...withBase,
        status: "no-data",
        message: `Data opening range sesi ini tidak lengkap untuk ${symbol}.`,
      };
    }
    const expected = Math.max(1, Math.ceil(input.minutes / 5));
    return {
      ...withBase,
      status: "waiting",
      message: `Opening range ${input.minutes} menit belum selesai (${range?.bars ?? 0} dari ${expected} bar 5 menit). Tunggu sampai ${minutesToHHMM(MARKET_OPEN_MINUTES + input.minutes)} ET.`,
    };
  }

  const triggerLevel = setup === "orb" ? (range?.high ?? null) : level;
  const rangeEnd = MARKET_OPEN_MINUTES + input.minutes;

  // Cari bar selesai pertama yang memicu.
  let hit: { when: string; price: number } | null = null;
  if (triggerLevel !== null) {
    if (setup === "orb") {
      const orb = detectOrb(series.bars, input.minutes, nowMs);
      if (orb.hit && orb.when && orb.price !== null) {
        hit = { when: orb.when, price: orb.price };
      }
    } else {
      for (const bar of sessionBars) {
        const barParts = getEtParts(new Date((bar.t + 1) * 1000));
        if (barParts.minutes < rangeEnd) continue;
        if (!isBarComplete(bar, 300, nowMs)) continue;
        if (bar.c > triggerLevel) {
          hit = { when: minutesToHHMM(barParts.minutes), price: bar.c };
          break;
        }
      }
    }
  }

  if (hit && triggerLevel !== null) {
    return {
      ...withBase,
      status: "triggered",
      level: triggerLevel,
      price: hit.price,
      barTime: hit.when,
      message:
        setup === "orb"
          ? `Tembus! Bar ${hit.when} ET tutup di ${fmtPrice(hit.price)}, di atas opening range high ${fmtPrice(triggerLevel)}.`
          : `Pemicu kena: bar ${hit.when} ET tutup di ${fmtPrice(hit.price)}, di atas level ${fmtPrice(triggerLevel)}.`,
    };
  }

  // Jendela entry berakhir / sesi selesai → kedaluwarsa.
  const closeMinutes = closeMinutesFor(market.sessionDate);
  const entryFromMinutes = hhmmToMinutes(settings.entryFrom);
  const entryToMinutes = Math.min(
    Math.max(entryFromMinutes, closeMinutes - 5),
    hhmmToMinutes(settings.entryTo),
  );
  const nowMinutes = getEtParts(new Date(nowMs)).minutes;
  const expired = market.state === "afterhours" || nowMinutes > entryToMinutes;
  const levelText = triggerLevel !== null ? fmtPrice(triggerLevel) : "level pemicu";
  const windowEnd = minutesToHHMM(entryToMinutes);

  if (expired) {
    return {
      ...withBase,
      status: "expired",
      message:
        setup === "orb"
          ? `Tidak ada bar 5 menit yang tutup di atas opening range high ${levelText} sampai jam entry berakhir (${windowEnd} ET).`
          : `Level ${levelText} tidak tertembus sampai jam entry berakhir (${windowEnd} ET).`,
    };
  }

  const distanceText = distancePct !== null ? `jarak ${fmtPct(distancePct)}` : "level belum tersedia";
  return {
    ...withBase,
    status: "waiting",
    message:
      setup === "orb"
        ? `Menunggu bar 5 menit tutup di atas opening range high ${levelText} (${distanceText}).`
        : `Menunggu bar 5 menit tutup di atas ${levelText} (${distanceText}).`,
  };
}

/**
 * GET /api/trading/entry
 * Query: symbol=TSLA, setup=orb|level, level=36418 (SEN, untuk level), minutes=15.
 * Respons: { trigger: TriggerState }
 */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) {
    return jsonError("Simbol saham tidak valid.", 422, {
      symbol: "Gunakan kode saham AS, mis. TSLA atau NVDA.",
    });
  }

  const setup = (url.searchParams.get("setup") ?? "orb").trim().toLowerCase() === "level"
    ? "level"
    : "orb";
  const minutes = Math.min(
    60,
    Math.max(5, numberParam(url.searchParams.get("minutes"), 15)),
  );

  let level: number | null = null;
  if (setup === "level") {
    const levelParam = numberParam(url.searchParams.get("level"), 0);
    if (!Number.isFinite(levelParam) || levelParam <= 0) {
      return jsonError("Level pemicu wajib diisi dalam sen (bilangan bulat).", 422, {
        level: "Isi harga pemicu dalam sen, mis. 36418.",
      });
    }
    level = levelParam;
  }

  const settings = await getTradingSettings(auth.user.id);
  let series: CandleSeries | null = null;
  try {
    series = await fetchChart(symbol, "1d", "5m");
  } catch {
    series = null;
  }

  const trigger = buildTrigger({
    symbol,
    setup,
    level,
    minutes,
    series,
    market: marketStatus(),
    settings,
    nowMs: Date.now(),
  });

  return jsonOk({ trigger });
}
