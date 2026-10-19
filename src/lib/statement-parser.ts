import { createHash } from "node:crypto";
import { MONTHS_LONG, MONTHS_SHORT, todayISO, toISODate } from "./date";
import type { TxType } from "./types";

/**
 * Parser mutasi/e-Statement (CSV) yang cukup toleran terhadap berbagai format:
 * - kolom tanggal/date/tgl
 * - kolom keterangan/uraian/description/note
 * - kolom nominal/amount, atau debit & kredit terpisah
 * - kolom jenis/type (DB/CR, debit/kredit, masuk/keluar)
 */

export interface StatementRow {
  type: TxType;
  amount: number;
  date: string;
  note: string;
}

const DATE_KEYS = ["tanggal", "tgl", "date", "transaction date", "posting date"];
const DESC_KEYS = ["keterangan", "uraian", "deskripsi", "description", "note", "catatan", "detail", "berita"];
const AMOUNT_KEYS = ["nominal", "amount", "jumlah", "nilai", "mutasi", "total"];
const DEBIT_KEYS = ["debit", "debet", "pengeluaran", "keluar", "db"];
const CREDIT_KEYS = ["kredit", "credit", "pemasukan", "masuk", "cr"];
const TYPE_KEYS = ["jenis", "type", "tipe", "d/k", "db/cr"];

const MONTH_LOOKUP: Record<string, number> = {};
MONTHS_LONG.forEach((name, index) => {
  MONTH_LOOKUP[name.toLowerCase()] = index + 1;
});
MONTHS_SHORT.forEach((name, index) => {
  MONTH_LOOKUP[name.toLowerCase()] = index + 1;
});

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findColumn(headers: string[], keys: string[]): number {
  for (let index = 0; index < headers.length; index += 1) {
    const header = normalizeHeader(headers[index]);
    if (keys.some((key) => header === key || header.includes(key))) return index;
  }
  return -1;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((cell) => cell.trim() !== ""));
}

function parseMoney(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text);
  text = text.replace(/[^\d.,]/g, "");
  if (!text) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  const lastSeparator = Math.max(lastComma, lastDot);

  if (lastSeparator >= 0) {
    const decimals = text.length - lastSeparator - 1;
    if (decimals === 2 && lastSeparator > 0) {
      const integerPart = text.slice(0, lastSeparator).replace(/[.,]/g, "");
      const decimalPart = text.slice(lastSeparator + 1);
      const value = Number(`${integerPart}.${decimalPart}`);
      if (Number.isFinite(value)) return negative ? -value : value;
    }
  }

  const digits = text.replace(/[.,]/g, "");
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

function parseDate(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const iso = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(text);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toISODate(year, month, day);
    }
  }

  const dmy = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(text);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toISODate(year, month, day);
    }
  }

  const named =
    /(\d{1,2})\s+(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)[a-z]*\s+(\d{4})/i.exec(
      text,
    );
  if (named) {
    const day = Number(named[1]);
    const month = MONTH_LOOKUP[named[2].toLowerCase()] ?? 0;
    const year = Number(named[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toISODate(year, month, day);
    }
  }

  return null;
}

function typeFromText(text: string): TxType | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  if (/^(db|debit|debet|d|dr|keluar|pengeluaran|expense)$/.test(value)) return "expense";
  if (/^(cr|kredit|credit|k|masuk|pemasukan|income)$/.test(value)) return "income";
  if (/(pemasukan|dana masuk|transfer masuk|gaji|refund|cashback)/i.test(value)) return "income";
  if (/(pengeluaran|pembelian|pembayaran|transfer keluar|tarik tunai|biaya)/i.test(value)) {
    return "expense";
  }
  return null;
}

export interface StatementParseResult {
  rows: StatementRow[];
  skipped: number;
}

export function parseStatementCsv(input: string): StatementParseResult {
  const text = input.replace(/^\uFEFF/, "").slice(0, 1_500_000);
  if (!text.trim()) return { rows: [], skipped: 0 };

  const delimiter = detectDelimiter(text);
  const table = splitCsv(text, delimiter);
  if (table.length === 0) return { rows: [], skipped: 0 };

  // Cari baris header: memuat kolom tanggal & (nominal|debit|kredit).
  let headerIndex = -1;
  for (let index = 0; index < Math.min(table.length, 8); index += 1) {
    const headers = table[index].map(normalizeHeader);
    const hasDate = findColumn(headers, DATE_KEYS) >= 0;
    const hasAmount =
      findColumn(headers, AMOUNT_KEYS) >= 0 ||
      findColumn(headers, DEBIT_KEYS) >= 0 ||
      findColumn(headers, CREDIT_KEYS) >= 0;
    if (hasDate && hasAmount) {
      headerIndex = index;
      break;
    }
  }

  const headers =
    headerIndex >= 0
      ? table[headerIndex].map(normalizeHeader)
      : ["tanggal", "keterangan", "nominal"];
  const dataRows = headerIndex >= 0 ? table.slice(headerIndex + 1) : table;

  let dateColumn = findColumn(headers, DATE_KEYS);
  let descColumn = findColumn(headers, DESC_KEYS);
  let amountColumn = findColumn(headers, AMOUNT_KEYS);
  const debitColumn = findColumn(headers, DEBIT_KEYS);
  const creditColumn = findColumn(headers, CREDIT_KEYS);
  const typeColumn = findColumn(headers, TYPE_KEYS);

  if (headerIndex < 0) {
    dateColumn = 0;
    descColumn = 1;
    if (headers.length >= 4 && !headers.includes("nominal")) {
      // Tanpa header: asumsi [tanggal, keterangan, debit, kredit].
      amountColumn = -1;
    } else {
      amountColumn = 2;
    }
  }

  const rows: StatementRow[] = [];
  let skipped = 0;

  for (const cells of dataRows) {
    if (rows.length >= 2000) break;

    const cell = (index: number): string => (index >= 0 ? (cells[index] ?? "").trim() : "");
    const date = parseDate(cell(dateColumn));
    if (!date) {
      skipped += 1;
      continue;
    }

    let type: TxType | null = null;
    let amount: number | null = null;

    const debit = debitColumn >= 0 ? parseMoney(cell(debitColumn)) : null;
    const credit = creditColumn >= 0 ? parseMoney(cell(creditColumn)) : null;

    if (debit && debit > 0) {
      type = "expense";
      amount = Math.abs(debit);
    } else if (credit && credit > 0) {
      type = "income";
      amount = Math.abs(credit);
    } else if (amountColumn >= 0) {
      const parsed = parseMoney(cell(amountColumn));
      if (parsed !== null && parsed !== 0) {
        amount = Math.abs(parsed);
        if (parsed < 0) type = "expense";
      }
    }

    if (typeColumn >= 0) {
      const fromType = typeFromText(cell(typeColumn));
      if (fromType) type = fromType;
    }

    const description = cell(descColumn);
    if (!type) type = typeFromText(description) ?? (amount && amount > 0 ? "expense" : null);
    if (!amount || amount <= 0 || !type) {
      skipped += 1;
      continue;
    }

    rows.push({
      type,
      amount: Math.round(amount),
      date,
      note: (description || "Impor mutasi").slice(0, 180),
    });
  }

  return { rows, skipped };
}

/** ID unik untuk deduplikasi baris mutasi. */
export function statementExternalId(row: StatementRow, index: number): string {
  return `statement:${createHash("sha256")
    .update(`${row.date}|${row.type}|${row.amount}|${row.note}|${index}`)
    .digest("hex")
    .slice(0, 32)}`;
}

export { todayISO };
