/**
 * Klien SEC EDGAR (server-side saja, tanpa dependensi).
 *
 * Dipakai halaman Inspeksi Saham untuk:
 * - daftar filing terbaru (form, tanggal, link dokumen) lewat `submissions`,
 * - ringkasan fundamental dari XBRL `companyfacts` (4 kuartal + 1 tahun + TTM + YoY).
 *
 * Catatan:
 * - SEC mewajibkan User-Agent yang menyebutkan aplikasi & kontak. Jangan
 *   memakai User-Agent browser palsu untuk data.sec.gov.
 * - Semua nominal revenue/laba dalam DOLAR (integer, sudah dibulatkan),
 *   EPS dalam dolar desimal. Bukan sen seperti harga di `types.ts`.
 * - Semua kegagalan jaringan ditangani sebagai "tidak tersedia", bukan error 500.
 */

import type { FilingItem, FundamentalsDTO, FundamentalsPeriod } from "./types";
import { findUniverseSymbol } from "./universe";
import { cached } from "./yahoo";

/** User-Agent sah untuk SEC (wajib, kalau tidak akan ditolak). */
const SEC_USER_AGENT = "Catatku Trading admin@catatku.id";

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_DATA_BASE = "https://data.sec.gov";
const SEC_ARCHIVE_BASE = "https://www.sec.gov/Archives/edgar/data";

/** Item 8-K yang dianggap penting untuk trader. */
export const IMPORTANT_8K_ITEMS = ["2.02", "5.02", "2.06", "3.01", "4.02", "1.03", "1.05"] as const;

export const SEC_SOURCE = "SEC EDGAR XBRL (companyfacts)";
export const SEC_UNAVAILABLE_SOURCE = "SEC EDGAR XBRL tidak tersedia";

const CIK_TTL_MS = 24 * 60 * 60_000;
const FILINGS_TTL_MS = 6 * 60 * 60_000;
const FUNDAMENTALS_TTL_MS = 6 * 60 * 60_000;
const FACTS_RETRY_TTL_MS = 5 * 60_000;
const NEWS_FILINGS_TTL_MS = 5 * 60_000;

/* ------------------------------------------------------------------ */
/* Fetch dasar                                                         */
/* ------------------------------------------------------------------ */

async function fetchSecJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  let lastError: unknown = null;
  // SEC kadang membalas 403/429 saat permintaan beruntun; coba ulang sekali.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": SEC_USER_AGENT,
          accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return (await response.json()) as T;
      lastError = new Error(`SEC EDGAR menolak permintaan (${response.status}).`);
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gagal menghubungi SEC EDGAR.");
}

export function padCik(cik: string): string {
  return cik.replace(/\D/g, "").padStart(10, "0");
}

/* ------------------------------------------------------------------ */
/* Peta simbol -> CIK                                                  */
/* ------------------------------------------------------------------ */

export interface CikInfo {
  cik: string;
  name: string;
}

export async function getCikMap(): Promise<Map<string, CikInfo>> {
  return cached("sec:cikmap", CIK_TTL_MS, async () => {
    const map = new Map<string, CikInfo>();
    const payload = await fetchSecJson<Record<string, { cik_str?: number; ticker?: string; title?: string }>>(
      SEC_TICKERS_URL,
      15_000,
    );
    for (const row of Object.values(payload)) {
      const ticker = typeof row?.ticker === "string" ? row.ticker.trim().toUpperCase() : "";
      const rawCik = typeof row?.cik_str === "number" ? row.cik_str : Number(row?.cik_str);
      if (!ticker || !Number.isFinite(rawCik) || rawCik <= 0) continue;
      map.set(ticker, {
        cik: String(Math.trunc(rawCik)),
        name: typeof row?.title === "string" && row.title ? row.title : ticker,
      });
    }
    return map;
  });
}

/** Cari CIK untuk simbol (BRK-B vs BRK.B dicoba keduanya). Tidak melempar error. */
export async function lookupCik(symbol: string): Promise<CikInfo | null> {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return null;
  const candidates = new Set<string>([clean]);
  if (clean.includes("-")) candidates.add(clean.replace(/-/g, "."));
  if (clean.includes(".")) candidates.add(clean.replace(/\./g, "-"));

  try {
    const map = await getCikMap();
    for (const candidate of candidates) {
      const hit = map.get(candidate);
      if (hit) return hit;
    }
  } catch {
    return null;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Submissions (filing terbaru)                                        */
/* ------------------------------------------------------------------ */

interface SubmissionsResponse {
  cik?: string;
  name?: string;
  filings?: {
    recent?: {
      form?: string[];
      filingDate?: string[];
      reportDate?: string[];
      accessionNumber?: string[];
      primaryDocument?: string[];
      items?: string[];
    };
  };
}

interface SubmissionIndex {
  name: string | null;
  form: string[];
  filingDate: string[];
  reportDate: string[];
  accessionNumber: string[];
  primaryDocument: string[];
  items: string[];
}

/**
 * Cache 5 menit + dedupe permintaan yang berjalan bersamaan, supaya panel
 * berita & daftar filing tidak memanggil endpoint SEC dua kali sekaligus.
 */
const submissionsCache = new Map<string, { expires: number; value: SubmissionIndex | null }>();
const inflightSubmissions = new Map<string, Promise<SubmissionIndex | null>>();

async function readSubmissions(cik: string): Promise<SubmissionIndex | null> {
  const padded = padCik(cik);
  const hit = submissionsCache.get(padded);
  if (hit && hit.expires > Date.now()) return hit.value;

  const inflight = inflightSubmissions.get(padded);
  if (inflight) return inflight;

  const promise = (async () => {
    const payload = await fetchSecJson<SubmissionsResponse>(
      `${SEC_DATA_BASE}/submissions/CIK${padded}.json`,
      15_000,
    );
    const recent = payload.filings?.recent;
    if (!recent) return null;
    return {
      name: typeof payload.name === "string" && payload.name ? payload.name : null,
      form: recent.form ?? [],
      filingDate: recent.filingDate ?? [],
      reportDate: recent.reportDate ?? [],
      accessionNumber: recent.accessionNumber ?? [],
      primaryDocument: recent.primaryDocument ?? [],
      items: recent.items ?? [],
    } satisfies SubmissionIndex;
  })()
    .then((value) => {
      submissionsCache.set(padded, { expires: Date.now() + 5 * 60_000, value });
      return value;
    })
    .finally(() => {
      inflightSubmissions.delete(padded);
    });

  inflightSubmissions.set(padded, promise);
  return promise;
}

export interface SecFilingRow {
  form: string;
  filingDate: string;
  reportDate: string;
  accessionNumber: string;
  primaryDocument: string;
  items: string[];
  url: string;
  important: boolean;
}

/** "2.02,9.01" -> ["2.02", "9.01"] */
export function parseFilingItems(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter((value) => /^\d{1,2}\.\d{2}$/.test(value));
}

export function isImportantFilingItems(items: string[]): boolean {
  return items.some((item) => (IMPORTANT_8K_ITEMS as readonly string[]).includes(item));
}

export function secFilingUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
  const archiveCik = String(Number(padCik(cik)));
  const accession = accessionNumber.replace(/-/g, "");
  const document = primaryDocument.trim();
  if (!accession) return `${SEC_ARCHIVE_BASE}/${archiveCik}/`;
  return document
    ? `${SEC_ARCHIVE_BASE}/${archiveCik}/${accession}/${document}`
    : `${SEC_ARCHIVE_BASE}/${archiveCik}/${accession}/`;
}

function buildFilingRows(cik: string, index: SubmissionIndex): SecFilingRow[] {
  const count = Math.min(
    index.form.length,
    index.filingDate.length,
    index.accessionNumber.length,
  );
  const rows: SecFilingRow[] = [];
  for (let i = 0; i < count; i += 1) {
    const form = (index.form[i] ?? "").trim();
    const filingDate = (index.filingDate[i] ?? "").trim();
    const accessionNumber = (index.accessionNumber[i] ?? "").trim();
    if (!form || !filingDate || !accessionNumber) continue;
    const primaryDocument = (index.primaryDocument[i] ?? "").trim();
    const reportDate = (index.reportDate[i] ?? "").trim() || filingDate;
    const items = parseFilingItems(index.items[i]);
    rows.push({
      form,
      filingDate,
      reportDate,
      accessionNumber,
      primaryDocument,
      items,
      url: secFilingUrl(cik, accessionNumber, primaryDocument),
      important: form.startsWith("8-K") && isImportantFilingItems(items),
    });
  }
  return rows;
}

/** 8 filing terbaru (semua form) untuk satu simbol; cache 6 jam. */
export async function getSecFilings(symbol: string, limit = 8): Promise<SecFilingRow[]> {
  const clean = symbol.trim().toUpperCase();
  return cached(`sec:filings:${clean}:${limit}`, FILINGS_TTL_MS, async () => {
    const info = await lookupCik(clean);
    if (!info) return [] as SecFilingRow[];
    const index = await readSubmissions(info.cik);
    if (!index) return [] as SecFilingRow[];
    return buildFilingRows(info.cik, index).slice(0, limit);
  });
}

/** Filing 8-K terbaru (untuk panel berita); cache pendek 5 menit. */
export async function getRecent8kFilings(
  symbol: string,
  limit = 5,
  ttlMs = NEWS_FILINGS_TTL_MS,
): Promise<SecFilingRow[]> {
  const clean = symbol.trim().toUpperCase();
  return cached(`sec:8k:${clean}:${limit}`, ttlMs, async () => {
    const info = await lookupCik(clean);
    if (!info) return [] as SecFilingRow[];
    const index = await readSubmissions(info.cik);
    if (!index) return [] as SecFilingRow[];
    return buildFilingRows(info.cik, index)
      .filter((row) => row.form === "8-K")
      .slice(0, limit);
  });
}

/** ISO waktu filing: jam 13.00 UTC supaya tanggal ET tidak bergeser. */
export function filingDateToIso(filingDate: string): string {
  const parsed = Date.parse(`${filingDate}T13:00:00.000Z`);
  if (Number.isNaN(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
}

export function toFilingItem(row: SecFilingRow): FilingItem {
  return {
    form: row.form,
    filedAt: filingDateToIso(row.filingDate),
    title: `${row.form} · ${row.reportDate}`,
    url: row.url,
    important: row.important,
  };
}

/* ------------------------------------------------------------------ */
/* Companyfacts / XBRL                                                 */
/* ------------------------------------------------------------------ */

interface FactValue {
  start?: string;
  end?: string;
  val?: number;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
}

interface CompanyFactsResponse {
  cik?: number;
  entityName?: string;
  facts?: {
    "us-gaap"?: Record<string, { units?: Record<string, FactValue[]> }>;
  };
}

interface PeriodPoint {
  start: string;
  end: string;
  val: number;
  fy: number | null;
  fp: string | null;
  filed: string;
}

interface ConceptPeriods {
  quarters: PeriodPoint[];
  /** Periode tahunan (10-K, ~12 bulan). */
  years: PeriodPoint[];
  /** Periode year-to-date (~9 bulan) untuk menurunkan kuartal ke-4. */
  ytd: PeriodPoint[];
}

const EMPTY_PERIODS: ConceptPeriods = { quarters: [], years: [], ytd: [] };

function daysBetween(start: string, end: string): number {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

function sortPointsDesc(a: PeriodPoint, b: PeriodPoint): number {
  return a.end < b.end ? 1 : a.end > b.end ? -1 : 0;
}

function collectPeriods(
  facts: Record<string, { units?: Record<string, FactValue[]> }> | undefined,
  concept: string,
  unit = "USD",
): ConceptPeriods {
  const rows = facts?.[concept]?.units?.[unit];
  if (!Array.isArray(rows) || !rows.length) return EMPTY_PERIODS;

  const quarters = new Map<string, PeriodPoint>();
  const years = new Map<string, PeriodPoint>();
  const ytd = new Map<string, PeriodPoint>();

  for (const row of rows) {
    if (!row || typeof row.val !== "number" || !Number.isFinite(row.val)) continue;
    const start = (row.start ?? "").trim();
    const end = (row.end ?? "").trim();
    if (!start || !end) continue;
    const form = (row.form ?? "").toUpperCase();
    if (!form.startsWith("10-") && form !== "20-F") continue;

    const days = daysBetween(start, end);
    const target =
      days >= 70 && days <= 110
        ? quarters
        : days >= 330 && days <= 400
          ? years
          : days >= 240 && days <= 300
            ? ytd
            : null;
    if (!target) continue;

    const point: PeriodPoint = {
      start,
      end,
      val: row.val,
      fy: typeof row.fy === "number" ? row.fy : null,
      fp: typeof row.fp === "string" ? row.fp.toUpperCase() : null,
      filed: typeof row.filed === "string" ? row.filed : "",
    };
    const existing = target.get(end);
    if (!existing || point.filed > existing.filed) target.set(end, point);
  }

  return {
    quarters: Array.from(quarters.values()).sort(sortPointsDesc),
    years: Array.from(years.values()).sort(sortPointsDesc),
    ytd: Array.from(ytd.values()).sort(sortPointsDesc),
  };
}

/**
 * XBRL 10-K jarang menandai kuartal ke-4 (hanya periode tahunan), sehingga
 * kuartal terakhir sering bolong. Turunkan Q4 = tahunan − YTD 9 bulan.
 */
function deriveFourthQuarter(periods: ConceptPeriods): void {
  if (!periods.years.length || !periods.ytd.length) return;
  const existingEnds = new Set(periods.quarters.map((point) => point.end));

  for (const annual of periods.years) {
    if (existingEnds.has(annual.end)) continue;
    const annualStart = Date.parse(`${annual.start}T00:00:00Z`);
    const annualEnd = Date.parse(`${annual.end}T00:00:00Z`);
    if (Number.isNaN(annualStart) || Number.isNaN(annualEnd)) continue;
    const annualDays = Math.round((annualEnd - annualStart) / 86_400_000);

    let match: PeriodPoint | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const candidate of periods.ytd) {
      const candidateStart = Date.parse(`${candidate.start}T00:00:00Z`);
      const candidateEnd = Date.parse(`${candidate.end}T00:00:00Z`);
      if (Number.isNaN(candidateStart) || Number.isNaN(candidateEnd)) continue;
      if (Math.abs(candidateStart - annualStart) > 10 * 86_400_000) continue;
      const gap = annualEnd - candidateEnd;
      if (gap <= 0 || gap > 110 * 86_400_000) continue;
      if (gap < bestGap) {
        bestGap = gap;
        match = candidate;
      }
    }
    if (!match) continue;

    const matchDays = daysBetween(match.start, match.end);
    const quarterDays = annualDays - matchDays;
    if (quarterDays < 70 || quarterDays > 110) continue;

    const quarterStart = new Date(annualEnd - quarterDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    periods.quarters.push({
      start: quarterStart,
      end: annual.end,
      val: annual.val - match.val,
      fy: annual.fy,
      fp: null,
      filed: annual.filed,
    });
    existingEnds.add(annual.end);
  }

  periods.quarters.sort(sortPointsDesc);
}

/**
 * Pilih konsep revenue yang paling mutakhir datanya.
 * Beberapa emiten (mis. bank) melaporkan pendapatan kuartalan lewat
 * `RevenuesNetOfInterestExpense`, sementara `Revenues` hanya berisi data lama.
 */
function pickRevenuePeriods(
  facts: Record<string, { units?: Record<string, FactValue[]> }> | undefined,
): ConceptPeriods {
  const concepts = [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenuesNetOfInterestExpense",
  ];
  let best: ConceptPeriods | null = null;
  let bestEnd = "";
  let bestQuarters = 0;
  for (const concept of concepts) {
    const periods = collectPeriods(facts, concept);
    if (!periods.quarters.length && !periods.years.length) continue;
    const latestEnd = periods.quarters[0]?.end ?? periods.years[0]?.end ?? "";
    if (
      latestEnd > bestEnd ||
      (latestEnd === bestEnd && periods.quarters.length > bestQuarters)
    ) {
      best = periods;
      bestEnd = latestEnd;
      bestQuarters = periods.quarters.length;
    }
  }
  return best ?? EMPTY_PERIODS;
}

function toPointMap(points: PeriodPoint[]): Map<string, PeriodPoint> {
  const map = new Map<string, PeriodPoint>();
  for (const point of points) map.set(point.end, point);
  return map;
}

/** Cari titik dengan tanggal akhir terdekat (toleransi 5 hari). */
function findPoint(map: Map<string, PeriodPoint>, end: string): PeriodPoint | null {
  const exact = map.get(end);
  if (exact) return exact;
  const target = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  let best: PeriodPoint | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const point of map.values()) {
    const time = Date.parse(`${point.end}T00:00:00Z`);
    if (Number.isNaN(time)) continue;
    const diff = Math.abs(time - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = point;
    }
  }
  return bestDiff <= 5 * 86_400_000 ? best : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function margin(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole <= 0) return null;
  return round2((part / whole) * 100);
}

function fiscalQuarterOf(
  end: string,
  fiscalEndMonth: number,
): { quarter: number; fiscalYear: number } | null {
  const date = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const offset = (((month - fiscalEndMonth) % 12) + 12) % 12;
  let quarter = Math.round(offset / 3);
  if (quarter === 0) quarter = 4;
  const fiscalYear = year + (month > fiscalEndMonth ? 1 : 0);
  return { quarter, fiscalYear };
}

/**
 * Label kuartal menurut tahun fiskal emiten (bukan fy/fp di XBRL, yang
 * kadang menunjuk tahun filing sehingga menyesatkan).
 */
function quarterLabel(end: string, fiscalEndMonth: number): string {
  const info = fiscalQuarterOf(end, fiscalEndMonth);
  if (!info) return end;
  return `Q${info.quarter} ${info.fiscalYear}`;
}

function yearLabel(end: string, fiscalEndMonth: number): string {
  const info = fiscalQuarterOf(end, fiscalEndMonth);
  if (!info) return `FY${end.slice(0, 4)}`;
  return `FY${info.fiscalYear}`;
}

interface ConceptMaps {
  revenue: Map<string, PeriodPoint>;
  gross: Map<string, PeriodPoint>;
  operating: Map<string, PeriodPoint>;
  net: Map<string, PeriodPoint>;
  eps: Map<string, PeriodPoint>;
}

function buildQuarterPeriod(
  end: string,
  maps: ConceptMaps,
  fiscalEndMonth: number,
): FundamentalsPeriod {
  const revenuePoint = findPoint(maps.revenue, end);
  const grossPoint = findPoint(maps.gross, end);
  const operatingPoint = findPoint(maps.operating, end);
  const netPoint = findPoint(maps.net, end);
  const epsPoint = findPoint(maps.eps, end);

  const revenue = revenuePoint ? Math.round(revenuePoint.val) : null;
  const netIncome = netPoint ? Math.round(netPoint.val) : null;
  const grossProfit = grossPoint ? Math.round(grossPoint.val) : null;
  const operatingIncome = operatingPoint ? Math.round(operatingPoint.val) : null;

  return {
    kind: "quarter",
    label: quarterLabel(end, fiscalEndMonth),
    end,
    revenue,
    netIncome,
    epsDiluted: epsPoint ? round4(epsPoint.val) : null,
    grossMargin: margin(grossProfit, revenue),
    operatingMargin: margin(operatingIncome, revenue),
    netMargin: margin(netIncome, revenue),
  };
}

function buildYearPeriod(
  end: string,
  maps: ConceptMaps,
  fiscalEndMonth: number,
): FundamentalsPeriod {
  const revenuePoint = findPoint(maps.revenue, end);
  const grossPoint = findPoint(maps.gross, end);
  const operatingPoint = findPoint(maps.operating, end);
  const netPoint = findPoint(maps.net, end);
  const epsPoint = findPoint(maps.eps, end);

  const revenue = revenuePoint ? Math.round(revenuePoint.val) : null;
  const netIncome = netPoint ? Math.round(netPoint.val) : null;
  const grossProfit = grossPoint ? Math.round(grossPoint.val) : null;
  const operatingIncome = operatingPoint ? Math.round(operatingPoint.val) : null;

  return {
    kind: "year",
    label: yearLabel(end, fiscalEndMonth),
    end,
    revenue,
    netIncome,
    epsDiluted: epsPoint ? round4(epsPoint.val) : null,
    grossMargin: margin(grossProfit, revenue),
    operatingMargin: margin(operatingIncome, revenue),
    netMargin: margin(netIncome, revenue),
  };
}

/** Bulan tutup tahun fiskal dari periode tahunan terbaru (default Desember). */
function fiscalEndMonthFor(yearEnds: string[]): number {
  const latest = yearEnds[0];
  if (!latest) return 12;
  const date = new Date(`${latest}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 12;
  return date.getUTCMonth() + 1;
}

function sumComplete(values: Array<number | null>): number | null {
  if (!values.length || values.some((value) => value === null)) return null;
  return values.reduce<number>((total, value) => total + (value as number), 0);
}

function pctChange(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null;
  return round2(((current - prior) / Math.abs(prior)) * 100);
}

function buildFundamentals(
  symbol: string,
  info: CikInfo,
  facts: CompanyFactsResponse,
): FundamentalsDTO {
  const gaap = facts.facts?.["us-gaap"];
  const revenuePeriods = pickRevenuePeriods(gaap);
  const grossPeriods = collectPeriods(gaap, "GrossProfit");
  const operatingPeriods = collectPeriods(gaap, "OperatingIncomeLoss");
  const netPeriods = collectPeriods(gaap, "NetIncomeLoss");
  const epsPeriods = collectPeriods(gaap, "EarningsPerShareDiluted", "USD/shares");

  // Isi kuartal ke-4 yang tidak ditandai 10-K (Q4 = tahunan − YTD 9 bulan).
  for (const periods of [
    revenuePeriods,
    grossPeriods,
    operatingPeriods,
    netPeriods,
    epsPeriods,
  ]) {
    deriveFourthQuarter(periods);
  }

  const yearMaps: ConceptMaps = {
    revenue: toPointMap(revenuePeriods.years),
    gross: toPointMap(grossPeriods.years),
    operating: toPointMap(operatingPeriods.years),
    net: toPointMap(netPeriods.years),
    eps: toPointMap(epsPeriods.years),
  };
  const yearEnds = Array.from(
    new Set([
      ...yearMaps.revenue.keys(),
      ...yearMaps.gross.keys(),
      ...yearMaps.operating.keys(),
      ...yearMaps.net.keys(),
      ...yearMaps.eps.keys(),
    ]),
  ).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  // Prioritaskan tahunan dengan angka pendapatan supaya bulan tutup fiskal benar.
  const preferredYearEnd =
    revenuePeriods.years[0]?.end ??
    grossPeriods.years[0]?.end ??
    operatingPeriods.years[0]?.end ??
    netPeriods.years[0]?.end ??
    epsPeriods.years[0]?.end ??
    yearEnds[0] ??
    null;
  const fiscalEndMonth = fiscalEndMonthFor(preferredYearEnd ? [preferredYearEnd] : []);
  const yearPeriod = preferredYearEnd
    ? buildYearPeriod(preferredYearEnd, yearMaps, fiscalEndMonth)
    : null;

  const maps: ConceptMaps = {
    revenue: toPointMap(revenuePeriods.quarters),
    gross: toPointMap(grossPeriods.quarters),
    operating: toPointMap(operatingPeriods.quarters),
    net: toPointMap(netPeriods.quarters),
    eps: toPointMap(epsPeriods.quarters),
  };

  const quarterEnds = Array.from(
    new Set([
      ...maps.revenue.keys(),
      ...maps.gross.keys(),
      ...maps.operating.keys(),
      ...maps.net.keys(),
      ...maps.eps.keys(),
    ]),
  ).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const allQuarters = quarterEnds.map((end) =>
    buildQuarterPeriod(end, maps, fiscalEndMonth),
  );
  const quarters = allQuarters.slice(0, 4);

  const ttmRevenue = sumComplete(quarters.map((period) => period.revenue));
  const ttmNetIncome = sumComplete(quarters.map((period) => period.netIncome));
  const ttmEpsRaw = sumComplete(quarters.map((period) => period.epsDiluted));
  const ttmEps = ttmEpsRaw === null ? null : round4(ttmEpsRaw);
  const ttm =
    ttmRevenue === null && ttmNetIncome === null && ttmEps === null
      ? null
      : { revenue: ttmRevenue, netIncome: ttmNetIncome, epsDiluted: ttmEps };

  const latest = allQuarters[0] ?? null;
  let priorYearQuarter: FundamentalsPeriod | null = null;
  if (latest) {
    const latestTime = Date.parse(`${latest.end}T00:00:00Z`);
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = 1; i < allQuarters.length; i += 1) {
      const candidate = allQuarters[i] as FundamentalsPeriod;
      const candidateTime = Date.parse(`${candidate.end}T00:00:00Z`);
      if (Number.isNaN(latestTime) || Number.isNaN(candidateTime)) continue;
      const diff = Math.abs(latestTime - candidateTime);
      if (diff >= 300 * 86_400_000 && diff <= 430 * 86_400_000 && diff < bestDiff) {
        bestDiff = diff;
        priorYearQuarter = candidate;
      }
    }
  }
  const revenuePct = latest ? pctChange(latest.revenue, priorYearQuarter?.revenue ?? null) : null;
  const netIncomePct = latest
    ? pctChange(latest.netIncome, priorYearQuarter?.netIncome ?? null)
    : null;
  const yoy =
    revenuePct === null && netIncomePct === null
      ? null
      : { revenuePct, netIncomePct };

  const companyName =
    typeof facts.entityName === "string" && facts.entityName
      ? facts.entityName
      : info.name || findUniverseSymbol(symbol)?.name || symbol;

  const periods: FundamentalsPeriod[] = [...quarters];
  if (yearPeriod) periods.push(yearPeriod);

  const source =
    periods.length > 0
      ? SEC_SOURCE
      : "SEC EDGAR XBRL tidak tersedia untuk emiten ini (mungkin bukan emiten AS).";

  return {
    symbol,
    companyName,
    cik: info.cik,
    periods,
    ttm,
    yoy,
    source,
    updatedAt: new Date().toISOString(),
  };
}

export function unavailableFundamentals(symbol: string): FundamentalsDTO {
  const clean = symbol.trim().toUpperCase();
  return {
    symbol: clean,
    companyName: findUniverseSymbol(clean)?.name ?? clean,
    cik: null,
    periods: [],
    ttm: null,
    yoy: null,
    source: "SEC EDGAR XBRL tidak tersedia untuk emiten ini (mungkin bukan emiten AS).",
    updatedAt: new Date().toISOString(),
  };
}

export interface FundamentalsResult {
  fundamentals: FundamentalsDTO;
  filings: FilingItem[];
}

interface CachedFundamentals {
  expires: number;
  value: FundamentalsResult;
}

/**
 * Cache khusus fundamental: hasil lengkap disimpan 6 jam, hasil "tidak
 * tersedia" hanya 5 menit supaya gangguan jaringan tidak menempel seharian.
 */
const fundamentalsCache = new Map<string, CachedFundamentals>();

async function loadFundamentals(symbol: string): Promise<FundamentalsResult> {
  const empty = unavailableFundamentals(symbol);
  const info = await lookupCik(symbol);
  if (!info) return { fundamentals: empty, filings: [] };

  const filings = await getSecFilings(symbol, 8)
    .then((rows) => rows.map(toFilingItem))
    .catch(() => [] as FilingItem[]);

  let facts: CompanyFactsResponse | null = null;
  try {
    facts = await fetchSecJson<CompanyFactsResponse>(
      `${SEC_DATA_BASE}/api/xbrl/companyfacts/CIK${padCik(info.cik)}.json`,
      15_000,
    );
  } catch {
    facts = null;
  }

  if (!facts) {
    return {
      fundamentals: {
        ...empty,
        cik: info.cik,
        companyName: info.name || empty.companyName,
      },
      filings,
    };
  }

  const fundamentals = buildFundamentals(symbol, info, facts);
  return { fundamentals, filings };
}

/** Fundamental SEC satu simbol. Tidak pernah melempar error. */
export async function getFundamentals(symbol: string): Promise<FundamentalsResult> {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return { fundamentals: unavailableFundamentals(""), filings: [] };

  const cachedEntry = fundamentalsCache.get(clean);
  if (cachedEntry && cachedEntry.expires > Date.now()) return cachedEntry.value;

  let result: FundamentalsResult;
  try {
    result = await loadFundamentals(clean);
  } catch {
    result = { fundamentals: unavailableFundamentals(clean), filings: [] };
  }

  const hasData = result.fundamentals.periods.length > 0 || result.filings.length > 0;
  fundamentalsCache.set(clean, {
    expires: Date.now() + (hasData ? FUNDAMENTALS_TTL_MS : FACTS_RETRY_TTL_MS),
    value: result,
  });
  if (fundamentalsCache.size > 200) {
    const now = Date.now();
    for (const [key, entry] of fundamentalsCache) {
      if (entry.expires <= now) fundamentalsCache.delete(key);
    }
  }
  return result;
}
