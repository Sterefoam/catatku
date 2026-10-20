import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { todayISO, toISODate } from "./date";
import type { TxType } from "./types";

/**
 * Parser e-Statement / mutasi rekening berformat PDF (best-effort).
 * Teks diekstrak dengan unpdf, lalu tiap baris yang diawali tanggal dan
 * memiliki nominal dianggap transaksi. Karena format PDF bank berbeda-beda,
 * hasil ditandai confidence "low" kecuali ada penanda debit/kredit yang jelas,
 * sehingga pengguna memeriksanya di Kotak Masuk.
 */

export type PdfRowConfidence = "high" | "low";

export interface PdfStatementRow {
  type: TxType;
  amount: number;
  date: string;
  note: string;
  confidence: PdfRowConfidence;
}

export interface PdfParseResult {
  rows: PdfStatementRow[];
  skipped: number;
  textLength: number;
  pages: number;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12,
};

const INCOME_WORDS =
  /(kredit|credit|\bcr\b|transfer\s+masuk|dana\s+masuk|penerimaan|pemasukan|gaji|salary|refund|cashback|bunga)/i;
const EXPENSE_WORDS =
  /(debit|debet|\bdb\b|pengeluaran|pembelian|pembayaran|qris|transfer\s+keluar|penarikan|tarik\s+tunai|biaya\s+admin|admin\s+fee|purchase|payment|withdrawal)/i;

function parseAmountToken(token: string): number | null {
  let text = token.replace(/[^\d.,-]/g, "").replace(/-/g, "");
  if (!text) return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma) {
    // Format Indonesia: 1.234.567,89 → 1234567.89
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = text.split(".");
    const last = parts[parts.length - 1];
    if (!(parts.length > 2 || (last && last.length === 3 && parts[0].length > 0))) {
      // "50.00" dianggap desimal.
      text = text.replace(/,/g, "");
    } else {
      text = parts.join("");
    }
  }

  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function extractAmounts(line: string): number[] {
  const matches = line.match(/-?\d{1,3}(?:\.\d{3})+(?:,\d{2})?|-?\d+,\d{2}/g);
  if (!matches) return [];
  const amounts: number[] = [];
  for (const token of matches) {
    const value = parseAmountToken(token);
    if (value !== null) amounts.push(value);
  }
  return amounts;
}

function extractDate(
  line: string,
  defaultYear: number,
): { date: string; rest: string } | null {
  // dd/mm/yyyy atau dd-mm-yy atau dd.mm
  const dmy = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/.exec(line);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = defaultYear;
    if (dmy[3]) {
      year = Number(dmy[3]);
      if (year < 100) year += 2000;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { date: toISODate(year, month, day), rest: line.slice(dmy[0].length) };
    }
  }

  // yyyy-mm-dd
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(line);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { date: toISODate(year, month, day), rest: line.slice(iso[0].length) };
    }
  }

  // dd Mmm yyyy / dd Mmm
  const named =
    /^(\d{1,2})\s+([a-zA-Z]{3,9})(?:\s+(\d{4}))?/.exec(line);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month) {
      const day = Number(named[1]);
      const year = named[3] ? Number(named[3]) : defaultYear;
      if (day >= 1 && day <= 31) {
        return { date: toISODate(year, month, day), rest: line.slice(named[0].length) };
      }
    }
  }

  return null;
}

function inferYear(text: string): number {
  const now = Number(todayISO().slice(0, 4));
  const period = /(?:periode|period|statement|tanggal\s*cetak)[^0-9]{0,30}(20\d{2})/i.exec(text);
  if (period?.[1]) return Number(period[1]);
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  if (years.length > 0) return years[0];
  return now;
}

function pickType(line: string): { type: TxType; confidence: PdfRowConfidence } {
  const debit = EXPENSE_WORDS.test(line);
  const credit = INCOME_WORDS.test(line);
  if (debit && !credit) return { type: "expense", confidence: "high" };
  if (credit && !debit) return { type: "income", confidence: "high" };
  return { type: "expense", confidence: "low" };
}

function cleanNote(rest: string): string {
  return rest
    .replace(/-?\d{1,3}(?:\.\d{3})+(?:,\d{2})?/g, " ")
    .replace(/-?\d+,\d{2}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s|:;\-–—]+/, "")
    .trim()
    .slice(0, 160);
}

export async function parseStatementPdf(buffer: Uint8Array): Promise<PdfParseResult> {
  const pdf = await getDocumentProxy(buffer);
  const extracted = await extractText(pdf, { mergePages: true });
  const text = String(extracted.text ?? "");
  const pages = extracted.totalPages ?? 0;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0 && !/^\d+$/.test(line));

  const defaultYear = inferYear(text);
  const rows: PdfStatementRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const line of lines) {
    if (rows.length >= 2000) break;

    const dateInfo = extractDate(line, defaultYear);
    if (!dateInfo) continue;

    const amounts = extractAmounts(dateInfo.rest);
    if (amounts.length === 0) {
      skipped += 1;
      continue;
    }

    let amount: number;
    if (amounts.length >= 2) {
      // Umumnya kolom terakhir adalah saldo; ambil nominal transaksi sebelumnya.
      const candidates = amounts.slice(0, amounts.length - 1).filter((value) => value > 0);
      amount = candidates.length > 0 ? candidates[candidates.length - 1] : amounts[0];
    } else {
      amount = amounts[0];
    }
    if (!amount || amount <= 0) {
      skipped += 1;
      continue;
    }

    const typeInfo = pickType(line);
    const note = cleanNote(dateInfo.rest) || "Mutasi PDF";
    const key = `${dateInfo.date}|${typeInfo.type}|${amount}|${note}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);

    rows.push({
      type: typeInfo.type,
      amount,
      date: dateInfo.date,
      note,
      confidence: typeInfo.confidence,
    });
  }

  return { rows, skipped, textLength: text.length, pages };
}

/** ID unik baris mutasi PDF untuk deduplikasi. */
export function pdfStatementExternalId(row: PdfStatementRow, index: number): string {
  return `pdf:${createHash("sha256")
    .update(`${row.date}|${row.type}|${row.amount}|${row.note}|${index}`)
    .digest("hex")
    .slice(0, 32)}`;
}
