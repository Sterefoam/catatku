import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { toISODate, todayISO } from "./date";
import type { TxType } from "./types";

/**
 * Parser e-Statement / mutasi rekening berformat PDF.
 *
 * Dua mode:
 * 1. Format BCA e-Statement (kolom TANGGAL KETERANGAN CBG MUTASI SALDO) —
 *    transaksi bisa terdiri dari banyak baris: tanggal, keterangan, kode,
 *    lalu nominal + DB/CR (+ saldo). Tanggal hanya dd/mm; tahun diambil dari
 *    "PERIODE : SEPTEMBER 2026".
 * 2. Format generik: baris yang diawali tanggal dan memuat nominal.
 *
 * Karena format PDF bank berbeda-beda, hasil ditandai confidence "low" bila
 * jenis transaksi tidak bisa dipastikan, sehingga pengguna memeriksanya di
 * Kotak Masuk.
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
  januari: 1,
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
  oct: 10,
  oktober: 10,
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

/* ------------------------------------------------------------------ */
/* Nominal                                                             */
/* ------------------------------------------------------------------ */

/**
 * Mengubah nominal dari PDF menjadi satuan minor (sen/rupiah tanpa desimal).
 * Mendukung "28,000.00" (BCA) dan "50.000,00" (Indonesia).
 */
function amountToMinor(raw: string): number | null {
  let text = raw.replace(/[^\d.,]/g, "");
  if (!text) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      // 50.000,00 → titik ribuan, koma desimal
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      // 28,000.00 → koma ribuan, titik desimal
      text = text.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const parts = text.split(",");
    text = parts.length === 2 && parts[1].length === 2 ? `${parts[0]}.${parts[1]}` : parts.join("");
  } else if (lastDot >= 0) {
    const parts = text.split(".");
    const last = parts[parts.length - 1];
    text = last.length === 2 ? `${parts.slice(0, -1).join("")}.${last}` : parts.join("");
  }

  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

const AMOUNT = String.raw`\d[\d.,]*[.,]\d{2}`;

interface AmountCandidate {
  amount: number;
  marker: "DB" | "CR" | null;
  saldo: number | null;
  /** true bila nominal ditulis dengan pemisah ribuan/desimal lengkap (mis. 700,000.00). */
  formatted: boolean;
}

function parseAmountToken(token: string): AmountCandidate | null {
  const amount = amountToMinor(token);
  if (amount === null) return null;
  return {
    amount,
    marker: null,
    saldo: null,
    formatted: token.includes(",") || token.split(".").length > 2,
  };
}

/** Baris nominal BCA: "28,000.00 DB 2,018,152.59", "7,000.00 DB", atau "700,000.00". */
function parseBcaAmountLine(line: string): AmountCandidate | null {
  let match = new RegExp(`^(${AMOUNT})\\s+(DB|CR)\\s+(${AMOUNT})$`, "i").exec(line);
  if (match) {
    const amount = amountToMinor(match[1]);
    const saldo = amountToMinor(match[3]);
    if (amount === null) return null;
    return {
      amount,
      marker: match[2].toUpperCase() as "DB" | "CR",
      saldo,
      formatted: true,
    };
  }

  match = new RegExp(`^(${AMOUNT})\\s+(DB|CR)$`, "i").exec(line);
  if (match) {
    const amount = amountToMinor(match[1]);
    if (amount === null) return null;
    return {
      amount,
      marker: match[2].toUpperCase() as "DB" | "CR",
      saldo: null,
      formatted: true,
    };
  }

  match = new RegExp(`^(${AMOUNT})\\s+(${AMOUNT})$`).exec(line);
  if (match) {
    const amount = amountToMinor(match[1]);
    const saldo = amountToMinor(match[2]);
    if (amount === null) return null;
    return { amount, marker: null, saldo, formatted: true };
  }

  match = new RegExp(`^(${AMOUNT})$`).exec(line);
  if (match) return parseAmountToken(match[1]);

  return null;
}

/* ------------------------------------------------------------------ */
/* Baris keterangan                                                    */
/* ------------------------------------------------------------------ */

const HEADER_LINE =
  /^(REKENING\b|K C P K O B A|RYAN ALVINO|LUBUK BESAR|RT\d{3}\b|JL\.|BANGKA|INDONESIA|NO\. REKENING|HALAMAN\b|PERIODE\b|MATA UANG|C A T A T A N|TANGGAL KETERANGAN|Bersambung|SALDO AWAL\b|SALDO AKHIR\b|MUTASI CR\b|MUTASI DB\b|\d+\s*\/\d+$|â€¢|•)/i;

function cleanDescription(line: string): string | null {
  let text = line
    .replace(/^0+\.\d{2}\s*/, "") // buang "00000.00" yang menempel ke nama merchant
    .replace(/\s+/g, " ")
    .trim();

  if (!/[A-Za-z]{2,}/.test(text)) return null;

  // Kode referensi seperti "12608/SHOPEE" → ambil bagian huruf terakhir.
  if (/^\d+\//.test(text)) {
    const parts = text.split("/").filter((part) => /[A-Za-z]{2,}/.test(part));
    text = parts[parts.length - 1] ?? "";
  }

  if (!text || HEADER_LINE.test(text)) return null;
  if (/^QR\s*\d+$/i.test(text)) return null;
  if (/^TGL\s*:/i.test(text)) return null;
  if (/^TANGGAL\s*:/i.test(text)) return null;
  if (/^TANGGAL$/i.test(text)) return null;
  if (/^(DB|CR)$/i.test(text)) return null;
  if (/^[-–—\s]+$/.test(text)) return null;

  return text.slice(0, 120);
}

function inferType(
  descriptions: string[],
  candidates: AmountCandidate[],
): { type: TxType; confidence: PdfRowConfidence } {
  const marker = [...candidates].reverse().find((candidate) => candidate.marker)?.marker;
  if (marker === "DB") return { type: "expense", confidence: "high" };
  if (marker === "CR") return { type: "income", confidence: "high" };

  const description = descriptions.join(" ");
  const hasCr = /\bCR\b/i.test(description);
  const hasDb = /\bDB\b/i.test(description);
  if (hasCr && !hasDb) return { type: "income", confidence: "high" };
  if (hasDb && !hasCr) return { type: "expense", confidence: "high" };
  if (INCOME_WORDS.test(description)) return { type: "income", confidence: "high" };
  if (EXPENSE_WORDS.test(description)) return { type: "expense", confidence: "high" };
  return { type: "expense", confidence: "low" };
}

function pickNote(descriptions: string[]): string {
  const meaningful = descriptions.filter(
    (text) => !/^(TRSF|TRANSAKSI|TANGGAL|TGL|BIF|BI-FAST|QR)\b/i.test(text),
  );
  const candidates = meaningful.length > 0 ? meaningful : descriptions;
  const note = candidates[candidates.length - 1] ?? candidates[0] ?? "Mutasi";
  return note.slice(0, 160);
}

/* ------------------------------------------------------------------ */
/* Parser BCA e-Statement                                              */
/* ------------------------------------------------------------------ */

interface BcaRecord {
  date: string;
  descriptions: string[];
  candidates: AmountCandidate[];
  skip: boolean;
}

function inferDefaultYear(text: string): number {
  const now = Number(todayISO().slice(0, 4));
  const period = /(?:periode|period|statement)[^0-9]{0,40}(20\d{2})/i.exec(text);
  if (period?.[1]) return Number(period[1]);
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  return years[0] ?? now;
}

function bcaDateFromLine(
  line: string,
  defaultYear: number,
): { date: string; rest: string } | null {
  const match = /^(\d{2})\/(\d{2})(?:\/(\d{4}))?\s*(.*)$/.exec(line);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : defaultYear;
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { date: toISODate(year, month, day), rest: match[4] ?? "" };
}

function finalizeBcaRecord(
  record: BcaRecord | null,
  rows: PdfStatementRow[],
  seen: Set<string>,
  skippedRef: { value: number },
): void {
  if (!record) return;

  if (record.skip) {
    skippedRef.value += 1;
    return;
  }

  const marked = [...record.candidates].reverse().find((candidate) => candidate.marker);
  const formatted = [...record.candidates]
    .reverse()
    .find((candidate) => candidate.formatted && candidate.marker === null);
  const candidate = marked ?? formatted ?? record.candidates[record.candidates.length - 1];
  if (!candidate) {
    skippedRef.value += 1;
    return;
  }

  const { type, confidence } = inferType(record.descriptions, record.candidates);
  const note = pickNote(record.descriptions);
  const key = `${record.date}|${type}|${candidate.amount}|${note}`;
  if (seen.has(key)) {
    skippedRef.value += 1;
    return;
  }
  seen.add(key);

  rows.push({
    type,
    amount: candidate.amount,
    date: record.date,
    note,
    confidence,
  });
}

function parseBcaStatement(
  lines: string[],
  defaultYear: number,
): { rows: PdfStatementRow[]; skipped: number } {
  const rows: PdfStatementRow[] = [];
  const seen = new Set<string>();
  const skippedRef = { value: 0 };
  let current: BcaRecord | null = null;

  for (const line of lines) {
    const dateInfo = bcaDateFromLine(line, defaultYear);
    if (dateInfo) {
      finalizeBcaRecord(current, rows, seen, skippedRef);
      current = {
        date: dateInfo.date,
        descriptions: [],
        candidates: [],
        skip: /^SALDO\s+(AWAL|AKHIR)/i.test(dateInfo.rest),
      };

      const rest = dateInfo.rest.trim();
      if (!current.skip && rest) {
        const trailing = new RegExp(
          `^(.*?)\\s+(${AMOUNT})(?:\\s+(DB|CR))?(?:\\s+(${AMOUNT}))?\\s*$`,
          "i",
        ).exec(rest);
        if (trailing) {
          const amount = amountToMinor(trailing[2]);
          if (amount !== null) {
            const description = cleanDescription(trailing[1]);
            if (description) current.descriptions.push(description);
            const candidate: AmountCandidate = {
              amount,
              marker: trailing[3] ? (trailing[3].toUpperCase() as "DB" | "CR") : null,
              saldo: trailing[4] ? amountToMinor(trailing[4]) : null,
              formatted: true,
            };
            current.candidates.push(candidate);
            if (candidate.marker || candidate.saldo !== null) {
              finalizeBcaRecord(current, rows, seen, skippedRef);
              current = null;
            }
          } else {
            const description = cleanDescription(rest);
            if (description) current.descriptions.push(description);
          }
        } else {
          const description = cleanDescription(rest);
          if (description) current.descriptions.push(description);
        }
      }
      continue;
    }

    if (!current) continue;

    const amountCandidate = parseBcaAmountLine(line.trim());
    if (amountCandidate) {
      current.candidates.push(amountCandidate);
      if (amountCandidate.marker) {
        // Baris nominal + DB/CR menandai akhir transaksi.
        finalizeBcaRecord(current, rows, seen, skippedRef);
        current = null;
      }
      continue;
    }

    const description = cleanDescription(line);
    if (description) current.descriptions.push(description);
  }

  finalizeBcaRecord(current, rows, seen, skippedRef);
  return { rows, skipped: skippedRef.value };
}

/* ------------------------------------------------------------------ */
/* Parser generik (bank lain)                                          */
/* ------------------------------------------------------------------ */

function parseGenericStatement(
  lines: string[],
  defaultYear: number,
): { rows: PdfStatementRow[]; skipped: number } {
  const rows: PdfStatementRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const line of lines) {
    const dateInfo = genericDateFromLine(line, defaultYear);
    if (!dateInfo) continue;

    const amounts: number[] = [];
    for (const match of dateInfo.rest.matchAll(new RegExp(AMOUNT, "g"))) {
      const amount = amountToMinor(match[0]);
      if (amount !== null) amounts.push(amount);
    }
    if (amounts.length === 0) {
      skipped += 1;
      continue;
    }

    const amount = amounts[0];
    const { type, confidence } = inferType([dateInfo.rest], [
      { amount, marker: null, saldo: null, formatted: true },
    ]);
    const note = cleanDescription(dateInfo.rest) ?? "Mutasi PDF";
    const key = `${dateInfo.date}|${type}|${amount}|${note}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    rows.push({ type, amount, date: dateInfo.date, note, confidence });
  }

  return { rows, skipped };
}

function genericDateFromLine(
  line: string,
  defaultYear: number,
): { date: string; rest: string } | null {
  const dmy = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s+(.*)$/.exec(line);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = defaultYear;
    if (dmy[3]) {
      year = Number(dmy[3]);
      if (year < 100) year += 2000;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { date: toISODate(year, month, day), rest: dmy[4] ?? "" };
    }
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(.*)$/.exec(line);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { date: toISODate(year, month, day), rest: iso[4] ?? "" };
    }
  }

  const named = /^(\d{1,2})\s+([a-zA-Z]{3,9})(?:\s+(\d{4}))?\s+(.*)$/.exec(line);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month) {
      const day = Number(named[1]);
      const year = named[3] ? Number(named[3]) : defaultYear;
      if (day >= 1 && day <= 31) {
        return { date: toISODate(year, month, day), rest: named[4] ?? "" };
      }
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function parseStatementPdf(buffer: Uint8Array): Promise<PdfParseResult> {
  const pdf = await getDocumentProxy(buffer);
  const extracted = await extractText(pdf, { mergePages: true });
  const text = String(extracted.text ?? "");
  const pages = extracted.totalPages ?? 0;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

  const defaultYear = inferDefaultYear(text);
  const isBca = /TANGGAL\s+KETERANGAN[\s\S]{0,120}MUTASI[\s\S]{0,60}SALDO/i.test(text);
  const parsed = isBca
    ? parseBcaStatement(lines, defaultYear)
    : parseGenericStatement(lines, defaultYear);

  return {
    rows: parsed.rows,
    skipped: parsed.skipped,
    textLength: text.length,
    pages,
  };
}

/** ID unik baris mutasi PDF untuk deduplikasi. */
export function pdfStatementExternalId(row: PdfStatementRow, index: number): string {
  return `pdf:${createHash("sha256")
    .update(`${row.date}|${row.type}|${row.amount}|${row.note}|${index}`)
    .digest("hex")
    .slice(0, 32)}`;
}
