/**
 * Mesin waktu (time machine) Meja Trading.
 *
 * Replay bootstrap dari bar 5 menit: setiap simulasi memilih satu sesi historis
 * + titik masuk acak setelah 10.00 ET, lalu menjalankan aturan yang sama
 * (target dulu / stop dulu / tidak keduanya sampai penutupan). Harga historis
 * diskalakan ke level entry rencana supaya persentase pergerakannya tetap utuh.
 *
 * Ini BUKAN prediksi. Hasil masa lalu tidak menjamin hasil masa depan.
 */

import { getEtParts } from "./market-clock";
import type { Bar, TimeMachineHistoryRow, TimeMachineResult } from "./types";

/** Titik masuk paling awal: 10.00 ET (opening range sudah lewat). */
export const TM_ENTRY_START_MINUTES = 10 * 60;
/** Jumlah simulasi bawaan. */
export const TM_DEFAULT_SIMULATIONS = 2000;
/** Batas simulasi supaya route tetap cepat. */
export const TM_MAX_SIMULATIONS = 20_000;
/** Maksimum baris riwayat sesi yang dikirim ke UI. */
export const TM_MAX_HISTORY_ROWS = 90;

const ASSUMPTIONS: string[] = [
  "Simulasi bootstrap dari bar 5 menit historis yang tersedia; ini bukan prediksi arah harga.",
  "Sesi & titik masuk dipilih acak setelah 10.00 ET, lalu harga historis diskalakan ke level entry rencana.",
  "Bila target dan stop tersentuh di bar yang sama, stop dianggap kena lebih dulu (pesimistis).",
  "Bar tempat masuk tidak dihitung untuk pemicu target/stop.",
  "Biaya transaksi, spread, dan slippage belum dihitung. Data gratis Yahoo Finance bisa tertunda.",
];

interface SessionSlice {
  date: string;
  bars: Bar[];
}

interface PreparedSession extends SessionSlice {
  /** Indeks bar yang boleh dipakai sebagai titik masuk. */
  candidates: number[];
}

interface WalkResult {
  outcome: "target" | "stop" | "none";
  /** Harga penutupan sesi (setelah diskalakan). */
  close: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Tanggal sesi ET dari sebuah bar 5 menit. */
function sessionDateOf(bar: Bar): string {
  return getEtParts(new Date((bar.t + 1) * 1000)).dateISO;
}

function groupSessions(bars: Bar[], nowMs: number): { sessions: SessionSlice[]; droppedToday: boolean } {
  const map = new Map<string, Bar[]>();
  for (const bar of bars) {
    if (!Number.isFinite(bar.t) || bar.t <= 0) continue;
    const date = sessionDateOf(bar);
    const list = map.get(date);
    if (list) list.push(bar);
    else map.set(date, [bar]);
  }

  const sessions: SessionSlice[] = Array.from(map.entries())
    .map(([date, list]) => ({
      date,
      bars: list.sort((a, b) => a.t - b.t),
    }))
    .filter((session) => session.bars.length >= 2)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Sesi hari ini yang masih berjalan tidak dipakai (jalur belum final).
  const etNow = getEtParts(new Date(nowMs));
  let droppedToday = false;
  const usable = sessions.filter((session) => {
    if (session.date !== etNow.dateISO) return true;
    const last = session.bars[session.bars.length - 1] as Bar;
    const complete = last.t * 1000 + 5 * 60_000 <= nowMs;
    if (!complete) droppedToday = true;
    return complete;
  });

  return { sessions: usable, droppedToday };
}

/** Indeks bar yang boleh jadi titik masuk: setelah 10.00 ET & masih ada bar sesudahnya. */
function eligibleEntryIndexes(session: SessionSlice): number[] {
  const indexes: number[] = [];
  for (let i = 0; i < session.bars.length - 1; i += 1) {
    const bar = session.bars[i] as Bar;
    if (bar.o <= 0) continue;
    const minutes = getEtParts(new Date((bar.t + 1) * 1000)).minutes;
    if (minutes >= TM_ENTRY_START_MINUTES) indexes.push(i);
  }
  return indexes;
}

/**
 * Jalankan aturan pada sisa sesi setelah titik masuk.
 * `scale` menyelaraskan harga historis dengan level entry rencana.
 */
function walkSession(
  bars: Bar[],
  startIndex: number,
  scale: number,
  stop: number,
  target: number,
): WalkResult {
  for (let i = startIndex + 1; i < bars.length; i += 1) {
    const bar = bars[i] as Bar;
    const high = bar.h * scale;
    const low = bar.l * scale;
    if (low <= stop && high >= target) {
      // Ambigu intra-bar: pilih skenario buruk.
      return { outcome: "stop", close: ((bars[bars.length - 1] as Bar).c) * scale };
    }
    if (high >= target) {
      return { outcome: "target", close: ((bars[bars.length - 1] as Bar).c) * scale };
    }
    if (low <= stop) {
      return { outcome: "stop", close: ((bars[bars.length - 1] as Bar).c) * scale };
    }
  }
  const last = bars[bars.length - 1] as Bar;
  return { outcome: "none", close: last.c * scale };
}

function emptyResult(
  symbol: string,
  entry: number,
  stop: number,
  target: number,
  assumptions: string[],
): TimeMachineResult {
  return {
    symbol,
    entry,
    stop,
    target,
    riskPerShare: Math.max(0, entry - stop),
    simulations: 0,
    targetFirstPct: 0,
    stopFirstPct: 0,
    neitherPct: 0,
    avgR: 0,
    closeUpPct: 0,
    closeDownPct: 0,
    historySessions: 0,
    history: [],
    assumptions,
  };
}

export interface SimulatePlanOptions {
  symbol: string;
  entry: number;
  stop: number;
  target: number;
  /** Bar 5 menit ±60 hari (engine yang mengambil dari Yahoo). */
  bars: Bar[];
  simulations?: number;
  /** Titik waktu sekarang (untuk uji & konsistensi). */
  now?: Date;
}

/**
 * Simulasikan rencana dari bar 5 menit historis. Tidak pernah melempar:
 * data/level yang tidak valid menghasilkan hasil nol + catatan asumsi.
 */
export function simulatePlan(options: SimulatePlanOptions): TimeMachineResult {
  const symbol = (options.symbol ?? "").trim().toUpperCase();
  const entry = Math.round(options.entry ?? 0);
  const stop = Math.round(options.stop ?? 0);
  const target = Math.round(options.target ?? 0);
  const nowMs = (options.now ?? new Date()).getTime();
  const assumptions = [...ASSUMPTIONS];

  const requested = clampInt(options.simulations ?? TM_DEFAULT_SIMULATIONS, 100, TM_MAX_SIMULATIONS);
  const riskPerShare = entry - stop;

  if (entry <= 0 || stop <= 0 || target <= 0 || riskPerShare <= 0 || target <= entry) {
    assumptions.push("Rencana belum valid (entry > stop, target > entry) sehingga simulasi tidak dijalankan.");
    return emptyResult(symbol, entry, stop, target, assumptions);
  }

  const { sessions, droppedToday } = groupSessions(options.bars ?? [], nowMs);
  if (droppedToday) {
    assumptions.push("Sesi hari ini yang masih berjalan tidak dipakai karena jalurnya belum final.");
  }

  const prepared: PreparedSession[] = sessions
    .map((session) => ({ ...session, candidates: eligibleEntryIndexes(session) }))
    .filter((session) => session.candidates.length > 0);

  if (!prepared.length) {
    assumptions.push("Data bar 5 menit belum cukup (butuh sesi dengan bar setelah 10.00 ET).");
    return emptyResult(symbol, entry, stop, target, assumptions);
  }

  assumptions[0] = `Simulasi bootstrap dari ${prepared.length} sesi historis bar 5 menit; ini bukan prediksi arah harga.`;

  const rewardR = (target - entry) / riskPerShare;
  if (prepared.length < 10) {
    assumptions.push(
      `Hanya ${prepared.length} sesi historis yang bisa dipakai — sampel kecil, hasil bisa lebar.`,
    );
  }

  // Riwayat: satu baris per sesi historis dengan aturan yang sama.
  const historyAll: TimeMachineHistoryRow[] = prepared.map((session) => {
    const index = session.candidates[0] as number;
    const entryBar = session.bars[index] as Bar;
    const scale = entry / entryBar.o;
    const walk = walkSession(session.bars, index, scale, stop, target);
    const r =
      walk.outcome === "target"
        ? rewardR
        : walk.outcome === "stop"
          ? -1
          : (walk.close - entry) / riskPerShare;
    return { date: session.date, outcome: walk.outcome, r: round2(r) };
  });
  historyAll.sort((a, b) => b.date.localeCompare(a.date));
  const history = historyAll.slice(0, TM_MAX_HISTORY_ROWS);

  // Bootstrap: pilih sesi & titik masuk acak.
  let targetCount = 0;
  let stopCount = 0;
  let neitherCount = 0;
  let closeUp = 0;
  let closeDown = 0;
  let rSum = 0;

  for (let i = 0; i < requested; i += 1) {
    const session = prepared[Math.floor(Math.random() * prepared.length)] as PreparedSession;
    const index =
      session.candidates[Math.floor(Math.random() * session.candidates.length)] as number;
    const entryBar = session.bars[index] as Bar;
    const scale = entry / entryBar.o;
    const walk = walkSession(session.bars, index, scale, stop, target);

    if (walk.outcome === "target") {
      targetCount += 1;
      rSum += rewardR;
    } else if (walk.outcome === "stop") {
      stopCount += 1;
      rSum -= 1;
    } else {
      neitherCount += 1;
    }

    if (walk.close > entry) closeUp += 1;
    else if (walk.close < entry) closeDown += 1;
  }

  const simulations = requested;
  return {
    symbol,
    entry,
    stop,
    target,
    riskPerShare,
    simulations,
    targetFirstPct: round1((targetCount / simulations) * 100),
    stopFirstPct: round1((stopCount / simulations) * 100),
    neitherPct: round1((neitherCount / simulations) * 100),
    avgR: round2(rSum / simulations),
    closeUpPct: round1((closeUp / simulations) * 100),
    closeDownPct: round1((closeDown / simulations) * 100),
    historySessions: historyAll.length,
    history,
    assumptions,
  };
}
