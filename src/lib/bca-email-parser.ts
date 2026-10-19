import { createHash } from "node:crypto";
import { MONTHS_LONG, MONTHS_SHORT, todayISO, toISODate } from "./date";
import type { TxType } from "./types";
import type { PendingConfidence } from "./inbox";

/**
 * Parser email notifikasi transaksi BCA.
 *
 * Format email BCA bisa berbeda antar layanan (transfer, kartu debit,
 * pembayaran). Parser ini mencari nominal, jenis transaksi, tanggal, dan
 * keterangan secara heuristik; bila ragu, confidence = "low" sehingga
 * transaksi masuk ke Kotak Masuk untuk dicek pengguna.
 */

export interface EmailPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
}

export interface ParsedEmailTransaction {
  type: TxType;
  amount: number;
  date: string;
  note: string;
  confidence: PendingConfidence;
  externalId: string;
  rawSubject: string;
  rawFrom: string;
}

const INCOME_WORDS =
  /(transfer\s+masuk|dana\s+masuk|penerimaan|pemasukan|gaji|payroll|refund|cashback|top\s*up|bunga|dividen|incoming|received|receive|salary|credit|\bcr\b)/i;
const EXPENSE_WORDS =
  /(pembelian|pembayaran|qris|transfer\s+keluar|pengeluaran|penarikan|tarik\s+tunai|biaya\s+admin|admin\s+fee|withdrawal|purchase|payment|debit|debet|\bdb\b)/i;

const MONTH_LOOKUP: Record<string, number> = {};
MONTHS_LONG.forEach((name, index) => {
  MONTH_LOOKUP[name.toLowerCase()] = index + 1;
});
MONTHS_SHORT.forEach((name, index) => {
  MONTH_LOOKUP[name.toLowerCase()] = index + 1;
});
// Alias bulan berbahasa Inggris (email BCA versi Inggris memakai Oct/Aug/Dec/May).
Object.assign(MONTH_LOOKUP, {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
});

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Ubah "1.234.567,00" / "Rp 1,234,567.00" menjadi angka rupiah. */
function parseMoney(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;

  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  text = text.replace(/[^\d.,]/g, "");
  if (!text) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  const lastSeparator = Math.max(lastComma, lastDot);

  if (lastSeparator >= 0) {
    const decimals = text.length - lastSeparator - 1;
    // Trailing 2 digit -> kemungkinan desimal (mis. "1.234.567,00").
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

function pickAmount(text: string): { amount: number; confidence: PendingConfidence } | null {
  // Contoh email BCA: "Total Payment : IDR 50,000.00" / "Total Pembayaran : Rp50.000"
  const labeled =
    /(?:total\s*(?:payment|amount|transaksi|pembayaran)?|nominal(?:\s+transaksi)?|jumlah(?:\s+transaksi)?|amount|nilai|sebesar)\s*[:=]?\s*(?:rp\.?|idr)?\s*([\d.,]+)/i.exec(
      text,
    );
  if (labeled?.[1]) {
    const amount = parseMoney(labeled[1]);
    if (amount && amount > 0) return { amount, confidence: "high" };
  }

  const matches = [...text.matchAll(/(?:rp\.?|idr)\s*([\d.,]*\d[\d.,]*)/gi)];
  for (const match of matches) {
    const amount = parseMoney(match[1] ?? "");
    if (!amount || amount <= 0) continue;
    // Hindari menangkap angka saldo ("Saldo: Rp...").
    const start = Math.max(0, (match.index ?? 0) - 28);
    const context = text.slice(start, match.index ?? 0).toLowerCase();
    if (/saldo|balance/.test(context)) continue;
    return { amount, confidence: "low" };
  }
  return null;
}

function pickType(text: string): { type: TxType; confidence: PendingConfidence } {
  // Baris "Transaction Type : QRIS Payment" / "Jenis Transaksi : Transfer".
  const typeLine =
    /(?:transaction\s+type|jenis\s+transaksi|tipe\s+transaksi)\s*[:\-]\s*([^\n]{2,80})/i.exec(
      text,
    )?.[1] ?? "";
  const scope = `${typeLine}\n${text}`;

  const income = INCOME_WORDS.test(scope);
  const expense = EXPENSE_WORDS.test(scope);

  // "QRIS Payment", "Pembayaran", "Withdrawal" jelas pengeluaran.
  if (/qris|payment|purchase|pembayaran|pembelian|penarikan|withdrawal/i.test(typeLine)) {
    return { type: "expense", confidence: "high" };
  }
  if (/incoming|received|transfer\s+from|salary|gaji|top\s*up|refund|pemasukan/i.test(typeLine)) {
    return { type: "income", confidence: "high" };
  }

  const debit = /\b(debit|debet|db)\b/i.test(scope);
  const credit = /\b(kredit|credit|cr)\b/i.test(scope);
  if (debit && !credit) return { type: "expense", confidence: "high" };
  if (credit && !debit) return { type: "income", confidence: "high" };

  if (income && !expense) return { type: "income", confidence: "high" };
  if (expense && !income) return { type: "expense", confidence: "high" };
  return { type: "expense", confidence: "low" };
}

function parseDateString(value: string): string | null {
  const text = value.trim();
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

  // dd Mmm yyyy (mis. 19 Oct 2026 / 19 Okt 2026)
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

  const dmy = /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/.exec(text);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toISODate(year, month, day);
    }
  }

  return null;
}

function pickDate(text: string): { date: string; confidence: PendingConfidence } {
  // Utamakan field bertanda: "Transaction Date : 19 Oct 2026 19:24:43".
  const labeled =
    /(?:transaction\s+date|tanggal\s+transaksi|tanggal|waktu\s+transaksi|date)\s*[:\-]\s*([^\n]{4,60})/i.exec(
      text,
    );
  if (labeled?.[1]) {
    const parsed = parseDateString(labeled[1]);
    if (parsed) return { date: parsed, confidence: "high" };
  }

  // Format tanggal BCA versi Inggris: "19 Oct 2026".
  const named =
    /(\d{1,2})\s+(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)[a-z]*\s+(\d{4})/i.exec(
      text,
    );
  if (named) {
    const parsed = parseDateString(named[0]);
    if (parsed) return { date: parsed, confidence: "high" };
  }

  const fallback = parseDateString(text);
  if (fallback) return { date: fallback, confidence: "low" };

  return { date: todayISO(), confidence: "low" };
}

function pickNote(text: string, subject: string): string {
  const labeled =
    /(?:payment\s+to|paid\s+to|payment\s+from|received\s+from|pembayaran\s+ke|dibayarkan\s+ke|merchant(?:\s+name)?|keterangan|berita|uraian|nama|tujuan|deskripsi|detail)\s*[:\-]\s*([^\n]{2,140})/i.exec(
      text,
    );
  if (labeled?.[1]) return labeled[1].replace(/\s+/g, " ").trim();

  const ignored =
    /^(hello|hai|hi|status|this email|if you|best regards|pt bank|for inquiries|please contact|please save|you just made|berikut|transaksi anda|demikian)/i;
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(
      (line) =>
        line.length >= 3 &&
        !ignored.test(line) &&
        !/^(rp|idr|saldo|tanggal|waktu|transaction date|amount)/i.test(line) &&
        !/@|https?:\/\//i.test(line),
    );
  if (lines[0]) return lines[0].slice(0, 140);

  const cleanSubject = subject
    .replace(/^(notifikasi|notification|bca|bank central asia|internet transaction journal)[^a-z0-9]*/gi, "")
    .trim();
  return (cleanSubject || "Transaksi BCA").slice(0, 140);
}

export function parseBcaEmail(payload: EmailPayload): ParsedEmailTransaction[] {
  const subject = (payload.subject ?? "").trim();
  const bodyText = payload.text?.trim()
    ? payload.text
    : payload.html
      ? stripHtml(payload.html)
      : "";
  const text = `${subject}\n${bodyText}`.replace(/\u00a0/g, " ").trim();

  if (!text) return [];

  const amountResult = pickAmount(text);
  if (!amountResult) return [];

  const typeResult = pickType(text);
  const dateResult = pickDate(text);
  const note = pickNote(bodyText || text, subject);
  const from = (payload.from ?? "").trim();
  const externalId = payload.messageId?.trim()
    ? `email:${payload.messageId.trim()}`
    : `email:${createHash("sha256").update(`${from}|${subject}|${text}`).digest("hex")}`;

  const confidence: PendingConfidence =
    amountResult.confidence === "high" &&
    typeResult.confidence === "high" &&
    dateResult.confidence === "high"
      ? "high"
      : "low";

  return [
    {
      type: typeResult.type,
      amount: Math.round(amountResult.amount),
      date: dateResult.date,
      note,
      confidence,
      externalId,
      rawSubject: subject.slice(0, 300),
      rawFrom: from.slice(0, 200),
    },
  ];
}

/** Ambil teks dari payload webhook berbagai penyedia email. */
export function normalizeEmailPayload(input: unknown): EmailPayload | null {
  if (!input || typeof input !== "object") return null;
  const body = input as Record<string, unknown>;
  const stringValue = (key: string): string | undefined => {
    const value = body[key];
    return typeof value === "string" ? value : undefined;
  };

  const from = stringValue("From") ?? stringValue("from") ?? stringValue("sender");
  const subject =
    stringValue("Subject") ?? stringValue("subject") ?? stringValue("headers.subject");
  const text =
    stringValue("TextBody") ??
    stringValue("text") ??
    stringValue("body-plain") ??
    stringValue("plain") ??
    stringValue("stripped-text");
  const html =
    stringValue("HtmlBody") ?? stringValue("html") ?? stringValue("body-html");
  const messageId =
    stringValue("MessageID") ??
    stringValue("messageId") ??
    stringValue("Message-Id") ??
    stringValue("message-id");

  if (!text && !html) return null;

  return {
    from: from?.replace(/<[^>]+>/g, "").trim() || undefined,
    to: stringValue("To") ?? stringValue("to") ?? stringValue("recipient"),
    subject,
    text,
    html,
    messageId,
  };
}
