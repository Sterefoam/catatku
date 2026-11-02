/**
 * Mesin rencana (plan engine) Meja Trading.
 *
 * Fungsi murni: dari draft rencana + pengaturan risiko + konteks pasar,
 * hitung stop, target, ukuran posisi, dan daftar cek risiko. Dipakai halaman
 * rencana & order kertas (desk) lewat route handler — tidak melakukan I/O.
 *
 * Kontrak encoding `stopPrice` (diputuskan Lead, lihat docs/TRADING.md):
 * - stopRule "price" : stopPrice = harga stop dalam SEN.
 * - stopRule "pct"   : stopPrice = persen × 100 (1,5% -> 150);
 *                      stop = entry − entry × (stopPrice / 10.000).
 * - stopRule "atr"   : stopPrice = kelipatan × 100 (1,5×ATR -> 150);
 *                      stop = entry − atr14 × (stopPrice / 100).
 * - stopRule "or-mid" / "or-low": pakai context.openingRange (fallback
 *   input.orHigh/orLow); stopPrice diabaikan.
 * Target: "1R" | "1.5R" | "2R" -> entry + R × risk; "price" -> targetPrice SEN.
 *
 * Pembulatan: stop ke BAWAH (konservatif), target ke ATAS (sen).
 */

import {
  closeMinutesFor,
  flatByFor,
  getEtParts,
  hhmmToMinutes,
  minutesToHHMM,
} from "./market-clock";
import { fmtPrice, fmtQty, fmtR, fmtVolume } from "./format";
import { minimumStopDistance } from "./technicals";
import type { TradingStats } from "./data";
import type {
  MarketStatus,
  OpeningRange,
  PlanDraft,
  PlanPreview,
  Quote,
  RiskCheckItem,
  SizeResult,
  StopRule,
  TargetRule,
  TradingSettings,
} from "./types";

export interface PlanContext {
  quote: Quote | null;
  atr14: number | null;
  openingRange: OpeningRange | null;
  market: MarketStatus;
  stats: TradingStats;
}

/** Persentase stop bawaan bila stopPrice kosong (1%). */
export const DEFAULT_STOP_PCT_ENCODED = 100;
/** Kelipatan ATR bawaan bila stopPrice kosong (1,5× ATR). */
export const DEFAULT_ATR_MULTIPLE_ENCODED = 150;
/** Volume minimal untuk day trade (lembar). */
export const MIN_LIQUID_VOLUME = 1_000_000;
export const MIN_SOFT_VOLUME = 250_000;
/** Selisih harga pemicu vs harga pasar yang masih dianggap wajar. */
export const MAX_PRICE_DRIFT_PCT = 20;
export const WARN_PRICE_DRIFT_PCT = 5;

const STOP_RULE_LABELS: Record<StopRule, string> = {
  "or-mid": "Tengah rentang awal",
  "or-low": "Bawah rentang awal",
  price: "Harga stop sendiri",
  pct: "Persen dari harga masuk",
  atr: "Kelipatan ayunan harga (ATR)",
};

const TARGET_RULE_LABELS: Record<TargetRule, string> = {
  "1R": "1R",
  "1.5R": "1,5R",
  "2R": "2R",
  price: "Harga sendiri",
};

const LIMIT_LABELS: Record<SizeResult["limitedBy"], string> = {
  "max-loss": "batas rugi per trade",
  "position-cap": "batas ukuran posisi",
  "max-order": "batas per order",
  cash: "kas setelah buffer",
  none: "tidak ada",
};

function usd(cents: number): string {
  return (cents / 100).toFixed(2);
}

function pctText(value: number, digits = 2): string {
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

function decimalText(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

function toNumberOrNull(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function checkItem(
  id: string,
  label: string,
  status: RiskCheckItem["status"],
  detail: string,
): RiskCheckItem {
  return { id, label, status, detail };
}

interface StopComputation {
  stop: number;
  label: string;
  issue: string | null;
}

function midOf(high: number | null, low: number | null): number | null {
  if (high === null || low === null || high <= 0 || low <= 0) return null;
  return Math.round((high + low) / 2);
}

function computeStop(input: PlanDraft, context: PlanContext): StopComputation {
  const entry = Math.round(toNumberOrNull(input.entryTrigger) ?? 0);
  const encoded = toNumberOrNull(input.stopPrice);
  const rule = input.stopRule;

  if (rule === "or-mid" || rule === "or-low") {
    const range = context.openingRange;
    const fallbackHigh = toNumberOrNull(input.orHigh);
    const fallbackLow = toNumberOrNull(input.orLow);
    const level =
      rule === "or-mid"
        ? range
          ? range.mid
          : midOf(fallbackHigh, fallbackLow)
        : range
          ? range.low
          : fallbackLow;
    const label = STOP_RULE_LABELS[rule];
    if (level === null || level <= 0) {
      return {
        stop: 0,
        label,
        issue:
          rule === "or-mid"
            ? "Opening range belum terbentuk — tunggu 15 menit pertama sesi atau pilih aturan stop lain."
            : "Batas bawah opening range belum tersedia — tunggu 15 menit pertama sesi atau pilih aturan stop lain.",
      };
    }
    return { stop: Math.floor(level), label, issue: null };
  }

  if (rule === "price") {
    const label = STOP_RULE_LABELS.price;
    if (encoded === null || encoded <= 0) {
      return { stop: 0, label, issue: "Harga stop belum diisi." };
    }
    return { stop: Math.floor(encoded), label, issue: null };
  }

  if (rule === "pct") {
    const pct = ((encoded ?? DEFAULT_STOP_PCT_ENCODED) / 100);
    const label = `${decimalText(pct, 2)}% di bawah entry`;
    if (entry <= 0) return { stop: 0, label, issue: "Harga entry belum valid." };
    const stop = Math.floor(entry - (entry * pct) / 100);
    return { stop, label, issue: null };
  }

  // rule === "atr"
  const multiple = (encoded ?? DEFAULT_ATR_MULTIPLE_ENCODED) / 100;
  const label = `${decimalText(multiple, 1)} × ATR 14`;
  const atr = toNumberOrNull(context.atr14);
  if (atr === null || atr <= 0) {
    return {
      stop: 0,
      label,
      issue: "ATR 14 belum tersedia — pilih aturan stop lain atau isi harga stop sendiri.",
    };
  }
  if (entry <= 0) return { stop: 0, label, issue: "Harga entry belum valid." };
  return { stop: Math.floor(entry - atr * multiple), label, issue: null };
}

interface TargetComputation {
  target: number;
  label: string;
  issue: string | null;
}

function computeTarget(input: PlanDraft, entry: number, riskPerShare: number): TargetComputation {
  const rule = input.targetRule;
  const label = TARGET_RULE_LABELS[rule];

  if (rule === "price") {
    const price = toNumberOrNull(input.targetPrice);
    if (price === null || price <= 0) {
      return { target: 0, label, issue: "Harga target belum diisi." };
    }
    return { target: Math.ceil(price), label, issue: null };
  }

  if (riskPerShare <= 0) {
    return { target: 0, label, issue: "Target belum bisa dihitung karena risiko per lembar tidak valid." };
  }

  const multiple = rule === "1R" ? 1 : rule === "1.5R" ? 1.5 : 2;
  return { target: Math.ceil(entry + multiple * riskPerShare), label, issue: null };
}

function computeSize(
  entry: number,
  riskPerShare: number,
  settings: TradingSettings,
): SizeResult {
  if (entry <= 0) {
    return { qty: 0, limitedBy: "none", riskAmount: 0, notional: 0, cashAfter: settings.budget };
  }

  const riskBudget = Math.max(0, Math.floor(settings.maxLossPerTrade));
  const cashAvailable = Math.max(0, Math.floor(settings.budget - settings.cashBuffer));
  const candidates: Array<{ qty: number; limitedBy: SizeResult["limitedBy"] }> = [
    {
      qty: riskPerShare > 0 ? Math.floor(riskBudget / riskPerShare) : 0,
      limitedBy: "max-loss",
    },
    { qty: Math.floor(Math.max(0, settings.maxPosition) / entry), limitedBy: "position-cap" },
    { qty: Math.floor(Math.max(0, settings.maxOrder) / entry), limitedBy: "max-order" },
    { qty: Math.floor(cashAvailable / entry), limitedBy: "cash" },
  ];

  let chosen = candidates[0] as { qty: number; limitedBy: SizeResult["limitedBy"] };
  for (const candidate of candidates) {
    if (candidate.qty < chosen.qty) chosen = candidate;
  }

  const qty = Math.max(0, Math.floor(chosen.qty));
  const riskAmount = qty > 0 && riskPerShare > 0 ? qty * riskPerShare : 0;
  const notional = qty * entry;
  return {
    qty,
    limitedBy: qty > 0 ? chosen.limitedBy : "none",
    riskAmount,
    notional,
    cashAfter: settings.budget - notional,
  };
}

/**
 * Hitung pratinjau rencana lengkap. Tidak pernah melempar: input yang buruk
 * berakhir menjadi daftar `checks` gagal + `errors` berbahasa Indonesia.
 */
export function computePlan(
  input: PlanDraft,
  settings: TradingSettings,
  context: PlanContext,
): PlanPreview {
  const entry = Math.round(toNumberOrNull(input.entryTrigger) ?? 0);
  const stopComputation = computeStop(input, context);
  const stop = stopComputation.stop;
  const riskPerShare = entry > 0 && stop > 0 ? Math.max(0, entry - stop) : 0;
  const targetComputation = computeTarget(input, entry, riskPerShare);
  const target = targetComputation.target;
  const rewardPerShare = target > 0 && entry > 0 ? Math.max(0, target - entry) : 0;
  const rewardRisk = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;
  const rMultiple = Math.round(rewardRisk * 100) / 100;
  const size = computeSize(entry, riskPerShare, settings);

  const range = context.openingRange;
  const orHigh = range ? range.high : toNumberOrNull(input.orHigh);
  const orLow = range ? range.low : toNumberOrNull(input.orLow);
  const flatBy = flatByFor(context.market.sessionDate, input.flatBy ?? settings.flatBy);

  const closeMinutes = closeMinutesFor(context.market.sessionDate);
  const entryFromMinutes = hhmmToMinutes(settings.entryFrom);
  const entryToMinutes = Math.min(
    Math.max(entryFromMinutes, closeMinutes - 5),
    hhmmToMinutes(settings.entryTo),
  );
  const windowLabel = `${minutesToHHMM(entryFromMinutes)}–${minutesToHHMM(entryToMinutes)} ET`;
  const nowMinutes = getEtParts(new Date(context.market.nowEt)).minutes;
  const quote = context.quote;

  const checks: RiskCheckItem[] = [];

  // 1. Harga pemicu entry.
  checks.push(
    entry > 0
      ? checkItem("entry", "Harga masuk", "pass", `Harga masuk ${fmtPrice(entry)}.`)
      : checkItem("entry", "Harga masuk", "fail", "Harga masuk belum diisi (harus lebih dari 0)."),
  );

  // 2. Stop wajib & di bawah entry.
  if (stopComputation.issue) {
    checks.push(checkItem("stop", "Batas rugi", "fail", stopComputation.issue));
  } else if (entry > 0 && stop > 0 && stop < entry) {
    checks.push(
      checkItem(
        "stop",
        "Batas rugi",
        "pass",
        `Stop ${fmtPrice(stop)} (${pctText(((entry - stop) / entry) * 100)} di bawah harga masuk).`,
      ),
    );
  } else {
    checks.push(
      checkItem(
        "stop",
        "Batas rugi",
        "fail",
        `Stop ${fmtPrice(stop)} harus di bawah harga masuk ${fmtPrice(entry)}.`,
      ),
    );
  }

  // 3. Target di atas entry.
  if (targetComputation.issue) {
    checks.push(checkItem("target", "Target untung", "fail", targetComputation.issue));
  } else if (target > entry) {
    checks.push(
      checkItem(
        "target",
        "Target untung",
        "pass",
        `Target ${fmtPrice(target)} = ${fmtR(rewardRisk)} dari risiko.`,
      ),
    );
  } else {
    checks.push(
      checkItem(
        "target",
        "Target untung",
        "fail",
        `Target ${fmtPrice(target)} harus di atas harga masuk ${fmtPrice(entry)}.`,
      ),
    );
  }

  // 4. Stop terlalu dekat (< 0,05% dari entry).
  if (riskPerShare <= 0 || entry <= 0) {
    checks.push(
      checkItem(
        "stop-distance",
        "Jarak batas rugi",
        "fail",
        "Jarak stop tidak valid — batas rugi harus di bawah harga masuk.",
      ),
    );
  } else {
    const minDistance = minimumStopDistance(entry);
    const distancePct = (riskPerShare / entry) * 100;
    checks.push(
      riskPerShare < minDistance
        ? checkItem(
            "stop-distance",
            "Jarak batas rugi",
            "fail",
            `Stop terlalu dekat: ${pctText(distancePct)} dari harga masuk, minimal 0,05% ($${usd(minDistance)}).`,
          )
        : checkItem(
            "stop-distance",
            "Jarak batas rugi",
            "pass",
            `Jarak stop ${pctText(distancePct)} dari harga masuk (minimum 0,05%).`,
          ),
    );
  }

  // 5. Ukuran posisi muat.
  checks.push(
    size.qty > 0
      ? checkItem(
          "size",
          "Jumlah lembar",
          "pass",
          `${fmtQty(size.qty)} lembar (dibatasi ${LIMIT_LABELS[size.limitedBy]}) · nilai beli ${fmtPrice(size.notional)}.`,
        )
      : checkItem(
          "size",
          "Jumlah lembar",
          "fail",
          riskPerShare > 0
            ? `Tidak ada ukuran yang muat: kerugian ${fmtPrice(riskPerShare)}/lembar vs batas ${fmtPrice(settings.maxLossPerTrade)} per trade.`
            : "Tidak ada ukuran yang muat karena stop belum valid.",
        ),
  );

  // 6. Risiko per trade.
  checks.push(
    size.qty > 0 && size.riskAmount <= settings.maxLossPerTrade
      ? checkItem(
          "risk",
          "Kerugian per trade",
          "pass",
          `Kerugian ${fmtPrice(size.riskAmount)} dari batas ${fmtPrice(settings.maxLossPerTrade)} per trade.`,
        )
      : checkItem(
          "risk",
          "Kerugian per trade",
          size.qty > 0 ? "fail" : "warn",
          size.qty > 0
            ? `Kerugian ${fmtPrice(size.riskAmount)} melebihi batas ${fmtPrice(settings.maxLossPerTrade)} per trade — rapatkan stop atau kecilkan jumlah lembar.`
            : "Belum ada jumlah lembar untuk dihitung.",
        ),
  );

  // 7. Rasio reward:risiko.
  if (riskPerShare <= 0 || target <= entry) {
    checks.push(
      checkItem("rr", "Imbalan : risiko", "fail", "Imbalan belum bisa dihitung karena stop/target belum valid."),
    );
  } else {
    checks.push(
      rewardRisk >= settings.minRewardRisk
        ? checkItem(
            "rr",
            "Imbalan : risiko",
            "pass",
            `${fmtR(rewardRisk)} dari minimum ${fmtR(settings.minRewardRisk)} (target ${fmtPrice(target)}).`,
          )
        : checkItem(
            "rr",
            "Imbalan : risiko",
            "fail",
            `Target hanya ${fmtR(rewardRisk)}, minimum ${fmtR(settings.minRewardRisk)} — geser target lebih jauh.`,
          ),
    );
  }

  // 8. Total risiko harian.
  const totalRiskToday = context.stats.riskToday + size.riskAmount;
  checks.push(
    totalRiskToday <= settings.dailyLossLimit
      ? checkItem(
          "daily-risk",
          "Batas rugi hari ini",
          "pass",
          `Risiko hari ini ${fmtPrice(context.stats.riskToday)} + rencana ${fmtPrice(size.riskAmount)} = ${fmtPrice(totalRiskToday)} dari ${fmtPrice(settings.dailyLossLimit)}.`,
        )
      : checkItem(
          "daily-risk",
          "Batas rugi hari ini",
          "fail",
          `Total kerugian hari ini ${fmtPrice(totalRiskToday)} melebihi batas ${fmtPrice(settings.dailyLossLimit)}.`,
        ),
  );

  // 9. Jumlah trade hari ini.
  checks.push(
    context.stats.tradesToday < settings.maxTradesPerDay
      ? checkItem(
          "trades",
          "Jatah trade hari ini",
          "pass",
          `${context.stats.tradesToday} dari ${settings.maxTradesPerDay} trade hari ini.`,
        )
      : checkItem(
          "trades",
          "Jatah trade hari ini",
          "fail",
          `Sudah ${context.stats.tradesToday} trade hari ini (batas ${settings.maxTradesPerDay}) — tunggu sesi berikutnya.`,
        ),
  );

  // 10. Jam entry (zona ET, hormati tutup dini).
  if (!context.market.isTradingDay) {
    checks.push(
      checkItem(
        "entry-window",
        "Jam masuk",
        "warn",
        `Bursa tutup — jam masuk ${windowLabel} akan diperiksa lagi saat sesi buka.`,
      ),
    );
  } else if (context.market.state !== "open") {
    checks.push(
      checkItem(
        "entry-window",
        "Jam masuk",
        "warn",
        `Di luar jam bursa — jam masuk ${windowLabel} diperiksa lagi saat pasar buka.`,
      ),
    );
  } else if (nowMinutes >= entryFromMinutes && nowMinutes <= entryToMinutes) {
    checks.push(
      checkItem(
        "entry-window",
        "Jam masuk",
        "pass",
        `Sekarang ${minutesToHHMM(nowMinutes)} ET, di dalam jendela ${windowLabel}.`,
      ),
    );
  } else {
    checks.push(
      checkItem(
        "entry-window",
        "Jam masuk",
        "fail",
        `Di luar jam masuk ${windowLabel} (sekarang ${minutesToHHMM(nowMinutes)} ET).`,
      ),
    );
  }

  // 11. Pasar tidak tertutup.
  if (context.market.state === "open") {
    checks.push(
      checkItem(
        "market",
        "Pasar sedang buka",
        "pass",
        `Pasar buka — sesi ${context.market.sessionDate} sampai ${minutesToHHMM(closeMinutes)} ET.`,
      ),
    );
  } else if (context.market.state === "premarket" || context.market.state === "afterhours") {
    checks.push(
      checkItem(
        "market",
        "Pasar sedang buka",
        "warn",
        context.market.state === "premarket"
          ? "Pra-pasar: order kertas baru bisa diisi setelah bel 09.30 ET."
          : "Pasca-pasar: sesi sudah selesai — order kertas bisa diisi saat pasar buka lagi.",
      ),
    );
  } else {
    checks.push(
      checkItem("market", "Pasar sedang buka", "fail", `${context.market.label}: ${context.market.detail}`),
    );
  }

  // 12. Harga pemicu selaras dengan harga pasar (±20%).
  if (!quote || quote.price <= 0) {
    checks.push(
      checkItem(
        "price-sync",
        "Harga masuk wajar",
        "warn",
        "Harga pasar belum tersedia — pastikan harga masuk sesuai layar.",
      ),
    );
  } else {
    const driftPct = (Math.abs(entry - quote.price) / quote.price) * 100;
    if (driftPct > MAX_PRICE_DRIFT_PCT) {
      checks.push(
        checkItem(
          "price-sync",
          "Harga masuk wajar",
          "fail",
          `Harga masuk ${fmtPrice(entry)} berbeda ${pctText(driftPct, 1)} dari harga pasar ${fmtPrice(quote.price)} (maks 20%).`,
        ),
      );
    } else if (driftPct > WARN_PRICE_DRIFT_PCT) {
      checks.push(
        checkItem(
          "price-sync",
          "Harga masuk wajar",
          "warn",
          `Harga masuk ${pctText(driftPct, 1)} dari harga pasar ${fmtPrice(quote.price)} — periksa apakah level masih relevan.`,
        ),
      );
    } else {
      checks.push(
        checkItem(
          "price-sync",
          "Harga masuk wajar",
          "pass",
          `Harga masuk ${fmtPrice(entry)} dekat harga pasar ${fmtPrice(quote.price)}.`,
        ),
      );
    }
  }

  // 13. Volume cukup.
  const volume = quote?.volume ?? null;
  if (volume === null) {
    checks.push(
      checkItem(
        "volume",
        "Saham ramai",
        "warn",
        "Volume hari ini belum tersedia — pastikan sahamnya ramai.",
      ),
    );
  } else if (volume >= MIN_LIQUID_VOLUME) {
    checks.push(
      checkItem("volume", "Saham ramai", "pass", `${fmtVolume(volume)} lembar hari ini — cukup likuid.`),
    );
  } else if (volume >= MIN_SOFT_VOLUME) {
    checks.push(
      checkItem(
        "volume",
        "Saham ramai",
        "warn",
        `${fmtVolume(volume)} lembar hari ini — agak tipis untuk day trade.`,
      ),
    );
  } else {
    checks.push(
      checkItem(
        "volume",
        "Saham ramai",
        "fail",
        `${fmtVolume(volume)} lembar hari ini — terlalu tipis; cari saham yang lebih ramai.`,
      ),
    );
  }

  const failChecks = checks.filter((check) => check.status === "fail");
  return {
    symbol: (input.symbol ?? "").trim().toUpperCase(),
    setupType: input.setupType,
    entry,
    stop,
    target,
    stopRuleLabel: stopComputation.label,
    targetRuleLabel: targetComputation.label,
    riskPerShare,
    rewardPerShare,
    rewardRisk,
    rMultiple,
    orHigh,
    orLow,
    flatBy,
    size,
    checks,
    ok: failChecks.length === 0,
    errors: failChecks.map((check) => check.detail),
  };
}
