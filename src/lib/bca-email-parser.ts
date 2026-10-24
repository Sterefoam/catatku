import { createHash } from "node:crypto";
import { MONTHS_LONG, MONTHS_SHORT, todayISO, toISODate } from "./date";
import type { TxType } from "./types";
import type { PendingConfidence } from "./inbox";

/**
 * Parser email notifikasi transaksi BCA.
 *
 * Email BCA punya beberapa template berbeda:
 * - QRIS Payment          : Payment to + Total Payment
 * - Transfer ke bank lain : Transfer Type + Beneficiary Name + Amount/Transfer Amount + Fee
 * - Pocket Transaction    : Transaction Type "Pocket Transaction" + Amount
 * - Flazz Top Up          : Top Up Amount
 * - Transfer masuk        : Transfer Received / Sender Name / Amount
 *
 * Parser membaca pasangan "Label : nilai" pada email, dengan fallback heuristik.
 * Nominal yang dikembalikan adalah RUPIAH UTUH (satuan IDR di aplikasi = Rp1,
 * bukan sen).
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
  /(transfer\s+masuk|dana\s+masuk|penerimaan|pemasukan|gaji|payroll|refund|cashback|bunga|dividen|incoming|received|receive|salary|credit|kredit)/i;
const EXPENSE_WORDS =
  /(pembelian|pembayaran|qris|transfer\s+keluar|transfer\s+to|pengeluaran|penarikan|tarik\s+tunai|biaya\s+admin|admin\s+fee|withdrawal|purchase|payment|debit|debet|autodebet|top\s*up|pocket|flazz)/i;

const MONTH_LOOKUP: Record<string, number> = {};
MONTHS_LONG.forEach((name, index) => {
  MONTH_LOOKUP[name.toLowerCase()] = index + 1;
});
MONTHS_SHORT.forEach((name, index) => {
  MONTH_LOOKUP[name.toLowerCase()] = index + 1;
});
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

/** Ubah "1.234.567,00" / "Rp 1,234,567.00" menjadi angka rupiah utuh. */
function parseMoney(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;
  if (/^[-–—]+$/.test(text)) return null;

  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  text = text.replace(/[^\d.,]/g, "");
  if (!text) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  const lastSeparator = Math.max(lastComma, lastDot);

  if (lastSeparator >= 0) {
    const decimals = text.length - lastSeparator - 1;
    // Trailing 2 digit -> desimal (mis. "1.234.567,00" atau "52,364.00").
    if (decimals === 2 && lastSeparator > 0) {
      const integerPart = text.slice(0, lastSeparator).replace(/[.,]/g, "");
      const decimalPart = text.slice(lastSeparator + 1);
      const value = Number(`${integerPart}.${decimalPart}`);
      if (Number.isFinite(value)) {
        return Math.round(negative ? -value : value);
      }
    }
  }

  const digits = text.replace(/[.,]/g, "");
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return Math.round(negative ? -value : value);
}

/** Ambil pasangan "Label : nilai" dari teks email. */
function extractFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z0-9 ./()_-]{1,60}?)\s*:\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    const key = match[1].toLowerCase().replace(/\s+/g, " ").trim();
    const value = match[2].trim();
    if (!value) continue;
    if (!(key in fields)) fields[key] = value;
  }
  return fields;
}

function pickField(fields: Record<string, string>, names: string[]): string | null {
  for (const name of names) {
    const value = fields[name];
    if (value && value.trim() && !/^[-–—]+$/.test(value.trim())) return value.trim();
  }
  return null;
}

function pickAmount(
  text: string,
  fields: Record<string, string>,
): { amount: number; fee: number; confidence: PendingConfidence } | null {
  const groups: string[][] = [
    ["total payment", "total pembayaran"],
    ["transfer amount", "jumlah transfer"],
    ["top up amount", "jumlah top up"],
    ["total transfer", "total transfer amount"],
    ["amount", "jumlah", "nominal", "nilai transaksi", "nilai"],
  ];

  for (const labels of groups) {
    const value = pickField(fields, labels);
    if (!value) continue;
    const amount = parseMoney(value);
    if (amount && amount > 0) {
      const feeValue = pickField(fields, ["fee", "biaya", "biaya transfer", "admin fee"]);
      const fee = feeValue ? (parseMoney(feeValue) ?? 0) : 0;
      return { amount, fee, confidence: "high" };
    }
  }

  // Fallback: cari nominal bertanda IDR/Rp pada teks.
  const matches = [...text.matchAll(/(?:rp\.?|idr)\s*([\d.,]*\d[\d.,]*)/gi)];
  for (const match of matches) {
    const amount = parseMoney(match[1] ?? "");
    if (!amount || amount <= 0) continue;
    const start = Math.max(0, (match.index ?? 0) - 32);
    const context = text.slice(start, match.index ?? 0).toLowerCase();
    if (/saldo|balance/.test(context)) continue;
    return { amount, fee: 0, confidence: "low" };
  }

  return null;
}

function pickType(
  text: string,
  fields: Record<string, string>,
): { type: TxType; confidence: PendingConfidence } {
  const explicitType = [
    fields["transaction type"],
    fields["transfer type"],
    fields["type of transaction"],
    fields["jenis transaksi"],
    fields["tipe transaksi"],
  ]
    .filter(Boolean)
    .join(" | ");
  const scope = `${explicitType}\n${text}`;

  // Template QRIS / payment / transfer keluar / pocket / Flazz = pengeluaran.
  if (
    /(qris|payment|purchase|pembayaran|pembelian|transfer\s+to|transfer\s+keluar|top\s*up|pocket|flazz|autodebet|debit|debet|withdrawal|penarikan|tarik\s+tunai)/i.test(
      explicitType,
    )
  ) {
    return { type: "expense", confidence: "high" };
  }

  // Template transfer masuk / penerimaan.
  if (
    /(transfer\s+received|transfer\s+masuk|received\s+from|incoming|sender|pengirim|dana\s+masuk|pemasukan|salary|gaji|refund|cashback|bunga|kredit)/i.test(
      explicitType,
    )
  ) {
    return { type: "income", confidence: "high" };
  }

  const income = INCOME_WORDS.test(scope);
  const expense = EXPENSE_WORDS.test(scope);
  if (income && !expense) return { type: "income", confidence: "high" };
  if (expense && !income) return { type: "expense", confidence: "high" };
  return { type: "expense", confidence: "low" };
}

function pickNote(
  text: string,
  fields: Record<string, string>,
  subject: string,
): string {
  const explicitType = (
    fields["transaction type"] ??
    fields["transfer type"] ??
    fields["type of transaction"] ??
    ""
  ).toLowerCase();

  if (explicitType.includes("pocket")) {
    const pocket = fields["beneficiary pocket"];
    return pocket ? `Top Up Pocket (${pocket})` : "Top Up Pocket";
  }
  if (explicitType.includes("flazz")) {
    return "Top Up Flazz";
  }

  const labeled = pickField(fields, [
    "payment to",
    "paid to",
    "merchant name",
    "merchant",
    "pembayaran ke",
    "dibayarkan ke",
    "beneficiary name",
    "nama penerima",
    "recipient name",
    "sender name",
    "nama pengirim",
    "pengirim",
    "remarks",
    "berita",
    "keterangan",
    "uraian",
  ]);
  if (labeled) return labeled.slice(0, 140);

  const fallbackType = pickField(fields, [
    "transaction type",
    "transfer type",
    "type of transaction",
    "jenis transaksi",
  ]);
  if (fallbackType) return fallbackType.slice(0, 140);

  const ignored =
    /^(hello|hai|hi|status|this email|if you|best regards|pt bank|for inquiries|please contact|please save|you just made|here are the details|berikut|transaksi anda|demikian|kepada)/i;
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
    .replace(
      /^(notifikasi|notification|bca|bank central asia|internet transaction journal)[^a-z0-9]*/gi,
      "",
    )
    .trim();
  return (cleanSubject || "Transaksi BCA").slice(0, 140);
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

function pickDate(
  text: string,
  fields: Record<string, string>,
): { date: string; confidence: PendingConfidence } {
  const labeled = pickField(fields, [
    "transaction date",
    "tanggal transaksi",
    "tanggal",
    "waktu transaksi",
    "date",
  ]);
  if (labeled) {
    const parsed = parseDateString(labeled);
    if (parsed) return { date: parsed, confidence: "high" };
  }

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

export function parseBcaEmail(payload: EmailPayload): ParsedEmailTransaction[] {
  const subject = (payload.subject ?? "").trim();
  const bodyText = payload.text?.trim()
    ? payload.text
    : payload.html
      ? stripHtml(payload.html)
      : "";
  const text = `${subject}\n${bodyText}`.replace(/\u00a0/g, " ").trim();

  if (!text) return [];

  const fields = extractFields(bodyText || text);
  const amountResult = pickAmount(bodyText || text, fields);
  if (!amountResult) return [];

  const typeResult = pickType(text, fields);
  const dateResult = pickDate(bodyText || text, fields);
  const note = pickNote(bodyText || text, fields, subject);
  const from = (payload.from ?? "").trim();
  const externalId = payload.messageId?.trim()
    ? `email:${payload.messageId.trim()}`
    : `email:${createHash("sha256").update(`${from}|${subject}|${text}`).digest("hex")}`;

  // Biaya transfer ditambahkan ke pengeluaran (total dana keluar).
  let amount = amountResult.amount;
  if (typeResult.type === "expense" && amountResult.fee > 0) {
    amount += amountResult.fee;
  }

  const confidence: PendingConfidence =
    amountResult.confidence === "high" &&
    typeResult.confidence === "high" &&
    dateResult.confidence === "high"
      ? "high"
      : "low";

  return [
    {
      type: typeResult.type,
      amount: Math.round(amount),
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
