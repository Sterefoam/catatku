/**
 * Utilitas uang. Nominal disimpan sebagai integer pada satuan terkecil
 * (IDR/JPY = 1, USD/EUR/dll = 1/100) agar penjumlahan selalu akurat.
 */

export const CURRENCIES = {
  IDR: {
    code: "IDR",
    label: "Rupiah Indonesia",
    symbol: "Rp",
    locale: "id-ID",
    decimals: 0,
  },
  USD: {
    code: "USD",
    label: "Dolar Amerika Serikat",
    symbol: "$",
    locale: "en-US",
    decimals: 2,
  },
  EUR: {
    code: "EUR",
    label: "Euro",
    symbol: "€",
    locale: "de-DE",
    decimals: 2,
  },
  SGD: {
    code: "SGD",
    label: "Dolar Singapura",
    symbol: "S$",
    locale: "en-SG",
    decimals: 2,
  },
  MYR: {
    code: "MYR",
    label: "Ringgit Malaysia",
    symbol: "RM",
    locale: "ms-MY",
    decimals: 2,
  },
  JPY: {
    code: "JPY",
    label: "Yen Jepang",
    symbol: "¥",
    locale: "ja-JP",
    decimals: 0,
  },
  GBP: {
    code: "GBP",
    label: "Pound Inggris",
    symbol: "£",
    locale: "en-GB",
    decimals: 2,
  },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const DEFAULT_CURRENCY: CurrencyCode = "IDR";
export const MINUS = "\u2212";

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && value in CURRENCIES;
}

export function currencyMeta(code?: string | null) {
  return CURRENCIES[isCurrencyCode(code) ? code : DEFAULT_CURRENCY];
}

/** Nilai satuan mayor (mis. 15000 rupiah) -> satuan terkecil (15000). */
export function toMinor(amount: number, currency?: string | null): number {
  const meta = currencyMeta(currency);
  return Math.round(amount * 10 ** meta.decimals);
}

/** Satuan terkecil -> nilai satuan mayor (15000 -> 15000; 1550 USD -> 15.5). */
export function fromMinor(minor: number, currency?: string | null): number {
  const meta = currencyMeta(currency);
  return minor / 10 ** meta.decimals;
}

/** Format nominal, mis. "Rp15.000" atau "$1,234.50". */
export function formatMoney(
  minor: number,
  currency?: string | null,
  options?: { signed?: boolean; bare?: boolean },
): string {
  const meta = currencyMeta(currency);
  const negative = minor < 0;
  const value = Math.abs(minor) / 10 ** meta.decimals;
  const formatter = new Intl.NumberFormat(meta.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: meta.decimals,
  });
  const body = `${meta.symbol}${formatter.format(value)}`;
  if (options?.bare) return negative ? `-${body}` : body;
  if (negative) return `${MINUS}${body}`;
  if (options?.signed) return `+${body}`;
  return body;
}

/** Format ringkas untuk sumbu grafik, mis. "Rp1,5 jt". */
export function formatMoneyCompact(minor: number, currency?: string | null): string {
  const meta = currencyMeta(currency);
  const value = Math.abs(minor) / 10 ** meta.decimals;
  const formatter = new Intl.NumberFormat(meta.locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const sign = minor < 0 ? MINUS : "";
  return `${sign}${meta.symbol}${formatter.format(value)}`;
}

/** Angka polos untuk diedit di input: 1500000 -> "1.500.000". */
export function formatMoneyInput(minor: number, currency?: string | null): string {
  const meta = currencyMeta(currency);
  const value = Math.abs(minor) / 10 ** meta.decimals;
  return new Intl.NumberFormat(meta.locale, {
    maximumFractionDigits: meta.decimals,
  }).format(value);
}

/**
 * Membaca input nominal yang diketik pengguna (bisa "15.000", "15,5",
 * "1.500.000,50", "$ 15"). Mengembalikan nilai satuan mayor atau null.
 */
export function parseAmountInput(raw: string): number | null {
  if (!raw) return null;
  let text = raw.replace(/[^\d.,\-]/g, "");
  if (!text) return null;

  const negative = text.startsWith("-");
  text = text.replace(/-/g, "");

  const hasDot = text.includes(".");
  const hasComma = text.includes(",");

  if (hasDot && hasComma) {
    const decimalSeparator = text.lastIndexOf(".") > text.lastIndexOf(",") ? "." : ",";
    const groupSeparator = decimalSeparator === "." ? "," : ".";
    text = text.split(groupSeparator).join("");
    text = text.replace(decimalSeparator, ".");
  } else if (hasComma) {
    const parts = text.split(",");
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      text = `${parts[0]}.${parts[1]}`;
    } else {
      text = parts.join("");
    }
  } else if (hasDot) {
    const parts = text.split(".");
    const last = parts[parts.length - 1] ?? "";
    if (parts.length === 2 && last.length > 0 && last.length <= 2) {
      // biarkan sebagai desimal ("15.5")
    } else {
      text = parts.join("");
    }
  }

  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** Ubah input pengguna langsung menjadi satuan terkecil. */
export function parseAmountToMinor(raw: string, currency?: string | null): number | null {
  const value = parseAmountInput(raw);
  if (value === null) return null;
  return toMinor(value, currency);
}

export function percentOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}
