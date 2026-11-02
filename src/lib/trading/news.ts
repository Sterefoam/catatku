/**
 * Berita & filing untuk Meja Trading (server-side saja, tanpa dependensi).
 *
 * Sumber:
 * - Headline Yahoo Finance lewat RSS resmi (gratis, bisa tertunda).
 * - Filing 8-K terbaru dari SEC EDGAR (butuh User-Agent sah, lihat `sec.ts`).
 *
 * Aturan:
 * - Tidak pernah mengarang berita. Kalau sumber gagal, kembalikan daftar kosong
 *   dan biarkan halaman menampilkan "tidak tersedia".
 * - Tag dari kata kunci judul/ringkasan; tag "moving" bila harga bergerak
 *   minimal 3% hari ini (bukan berita karangan, hanya penanda).
 * - Daftar diurutkan dari yang terbaru, judul ganda dibuang.
 */

import type { NewsItem, Quote } from "./types";
import { etWallToDate } from "./market-clock";
import { cached, fetchQuotes, mapLimit } from "./yahoo";
import {
  filingDateToIso,
  getRecent8kFilings,
  type SecFilingRow,
} from "./sec";

const RSS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const RSS_ENDPOINT = "https://feeds.finance.yahoo.com/rss/2.0/headline";

export const NEWS_TTL_MS = 5 * 60_000;
export const DEFAULT_NEWS_HOURS = 48;
export const MAX_NEWS_SYMBOLS = 10;
export const MAX_HEADLINES_PER_SYMBOL = 12;
export const MAX_FILINGS_PER_SYMBOL = 5;
export const MOVING_CHANGE_PCT = 3;

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

/* ------------------------------------------------------------------ */
/* Parsing XML sederhana (regex, tanpa dependensi)                     */
/* ------------------------------------------------------------------ */

interface RawHeadline {
  title: string;
  link: string;
  /** ISO 8601 UTC. */
  publishedAt: string;
  summary: string | null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
  middot: "·",
};

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (/^#x/i.test(entity)) return safeFromCodePoint(Number.parseInt(entity.slice(2), 16)) || match;
    if (entity.startsWith("#")) return safeFromCodePoint(Number.parseInt(entity.slice(1), 10)) || match;
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function stripMarkup(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function cleanXmlText(raw: string | null | undefined): string {
  if (!raw) return "";
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return stripMarkup(withoutCdata);
}

function xmlTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  return match?.[1] ?? null;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function parseRssDate(value: string): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function parseHeadlineRss(xml: string): RawHeadline[] {
  if (!xml || !/<item\b/i.test(xml)) return [];
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  const rows: RawHeadline[] = [];
  for (const block of blocks) {
    const title = cleanXmlText(xmlTag(block, "title"));
    const link = cleanXmlText(xmlTag(block, "link"));
    if (!title || !link || !/^https?:\/\//i.test(link)) continue;
    const publishedAt = parseRssDate(cleanXmlText(xmlTag(block, "pubDate")));
    if (!publishedAt) continue;
    const summaryText = cleanXmlText(xmlTag(block, "description"));
    rows.push({
      title,
      link,
      publishedAt,
      summary: summaryText ? truncate(summaryText, 240) : null,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Tag dari kata kunci                                                 */
/* ------------------------------------------------------------------ */

interface TagRule {
  tag: string;
  keywords: string[];
}

const TAG_RULES: TagRule[] = [
  {
    tag: "earnings",
    keywords: [
      "earnings",
      "eps",
      "revenue",
      "profit",
      "quarterly",
      "guidance",
      "fiscal",
      "results",
    ],
  },
  {
    tag: "analyst",
    keywords: [
      "analyst",
      "analysts",
      "upgrade",
      "upgrades",
      "downgrade",
      "downgrades",
      "price target",
      "rating",
      "initiated",
      "outperform",
      "underperform",
    ],
  },
  {
    tag: "deal",
    keywords: [
      "merger",
      "mergers",
      "acquire",
      "acquires",
      "acquisition",
      "takeover",
      "buyout",
      "deal",
      "stake",
      "partnership",
      "joint venture",
    ],
  },
  {
    tag: "halt",
    keywords: ["halt", "halted", "suspend", "suspended", "suspension", "trading pause"],
  },
  {
    tag: "regulatory",
    keywords: [
      "sec",
      "fda",
      "probe",
      "probes",
      "lawsuit",
      "antitrust",
      "investigation",
      "settlement",
      "subpoena",
      "regulator",
      "regulators",
      "compliance",
    ],
  },
  {
    tag: "macro",
    keywords: [
      "fed",
      "federal reserve",
      "cpi",
      "inflation",
      "interest rate",
      "rate cut",
      "rate hike",
      "rates",
      "tariff",
      "tariffs",
      "gdp",
      "jobs report",
      "payrolls",
      "treasury yield",
    ],
  },
  {
    tag: "capital",
    keywords: [
      "offering",
      "buyback",
      "repurchase",
      "dividend",
      "share sale",
      "capital raise",
      "convertible",
    ],
  },
  {
    tag: "people",
    keywords: [
      "ceo",
      "cfo",
      "coo",
      "chief",
      "founder",
      "resign",
      "resignation",
      "steps down",
      "appoint",
      "appointed",
      "board",
    ],
  },
  {
    tag: "risk",
    keywords: [
      "bankruptcy",
      "warning",
      "impairment",
      "layoff",
      "layoffs",
      "default",
      "fraud",
      "restatement",
      "going concern",
      "delisting",
      "delist",
      "recall",
    ],
  },
];

function hasKeyword(haystack: string, keyword: string): boolean {
  if (keyword.length <= 3) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
  }
  return haystack.includes(keyword);
}

/** Tag berita dari teks (judul + ringkasan). */
export function headlineTags(text: string): string[] {
  const haystack = ` ${text.toLowerCase()} `;
  const tags: string[] = [];
  for (const rule of TAG_RULES) {
    if (rule.keywords.some((keyword) => hasKeyword(haystack, keyword))) {
      tags.push(rule.tag);
    }
  }
  return tags;
}

/** Label item 8-K dalam bahasa Indonesia (fakta, bukan tafsiran). */
export const FILING_ITEM_LABELS: Record<string, string> = {
  "1.01": "Perjanjian material",
  "1.02": "Pengakhiran perjanjian material",
  "1.03": "Kebangkrutan / penerimaan",
  "1.04": "Keselamatan tambang",
  "1.05": "Insiden keamanan siber material",
  "2.01": "Selesainya akuisisi / pelepasan",
  "2.02": "Hasil operasi & kondisi keuangan",
  "2.03": "Kewajiban keuangan langsung baru",
  "2.04": "Pemicu percepatan kewajiban keuangan",
  "2.05": "Biaya keluar / restrukturisasi",
  "2.06": "Penurunan nilai material",
  "3.01": "Pemberitahuan delisting",
  "3.02": "Penjualan ekuitas belum terdaftar",
  "3.03": "Perubahan hak pemegang saham",
  "4.01": "Perubahan auditor",
  "4.02": "Laporan keuangan sebelumnya tidak dapat diandalkan",
  "5.01": "Perubahan kendali perusahaan",
  "5.02": "Pergantian direktur / pejabat eksekutif",
  "5.03": "Perubahan anggaran dasar / tahun fiskal",
  "5.04": "Penangguhan sementara perdagangan saham karyawan",
  "5.05": "Perubahan kode etik",
  "5.06": "Perubahan status perusahaan cangkang",
  "5.07": "Hasil voting pemegang saham",
  "5.08": "Nominasi direktur oleh pemegang saham",
  "6.01": "Informasi material sekuritas aset",
  "6.02": "Perubahan servicer",
  "6.03": "Perubahan penjaminan kredit",
  "6.04": "Gagal membayar distribusi wajib",
  "6.05": "Pembaruan pengungkapan Securities Act",
  "7.01": "Pengungkapan regulasi FD",
  "8.01": "Kejadian material lain",
  "9.01": "Lampiran keuangan",
};

export function filingTags(items: string[]): string[] {
  const tags = new Set<string>(["sec", "filing"]);
  if (items.includes("2.02")) tags.add("earnings");
  if (items.includes("5.02")) tags.add("people");
  if (items.includes("1.01") || items.includes("2.01")) tags.add("deal");
  if (
    items.some((item) =>
      ["1.03", "1.05", "2.06", "3.01", "4.02"].includes(item),
    )
  ) {
    tags.add("risk");
  }
  return Array.from(tags);
}

function filingSummary(items: string[]): string | null {
  if (!items.length) return null;
  const labels = items
    .slice(0, 4)
    .map((item) => `${item} ${FILING_ITEM_LABELS[item] ?? "Item 8-K"}`);
  return `Item 8-K: ${labels.join(" · ")}`;
}

/* ------------------------------------------------------------------ */
/* Cache & pengambilan RSS                                             */
/* ------------------------------------------------------------------ */

async function fetchHeadlines(symbol: string): Promise<RawHeadline[]> {
  return cached(`news:rss:${symbol}`, NEWS_TTL_MS, async () => {
    const params = new URLSearchParams({ s: symbol, region: "US", lang: "en-US" });
    const response = await fetch(`${RSS_ENDPOINT}?${params.toString()}`, {
      headers: {
        "user-agent": RSS_USER_AGENT,
        accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`RSS Yahoo membalas ${response.status}.`);
    return parseHeadlineRss(await response.text());
  });
}

/* ------------------------------------------------------------------ */
/* Utilitas kecil                                                      */
/* ------------------------------------------------------------------ */

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hash stabil (djb2) supaya React key tidak berubah tiap render. */
function stableId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return `n${hash.toString(36)}`;
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean)));
}

function filingPublishedAt(filingDate: string): string {
  try {
    return etWallToDate(filingDate, 0).toISOString();
  } catch {
    return filingDateToIso(filingDate);
  }
}

function sortNewestFirst<T extends { publishedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.publishedAt === b.publishedAt) return 0;
    return a.publishedAt < b.publishedAt ? 1 : -1;
  });
}

/* ------------------------------------------------------------------ */
/* API publik                                                          */
/* ------------------------------------------------------------------ */

/** Bersihkan & batasi daftar simbol (maks 10, unik, format valid). */
export function sanitizeNewsSymbols(symbols: string[]): string[] {
  const clean = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => SYMBOL_RE.test(symbol));
  return Array.from(new Set(clean)).slice(0, MAX_NEWS_SYMBOLS);
}

/**
 * Berita + 8-K untuk sekumpulan simbol, maksimal 12 headline per simbol.
 * Tidak melempar error: sumber yang gagal hanya menghasilkan daftar kosong.
 */
export async function getTradingNews(
  symbols: string[],
  hours = DEFAULT_NEWS_HOURS,
): Promise<NewsItem[]> {
  const clean = sanitizeNewsSymbols(symbols);
  if (!clean.length) return [];

  const safeHours = Number.isFinite(hours)
    ? Math.min(168, Math.max(1, Math.round(hours)))
    : DEFAULT_NEWS_HOURS;
  const cutoff = Date.now() - safeHours * 60 * 60_000;

  let quotes = new Map<string, Quote>();
  try {
    quotes = await fetchQuotes(clean);
  } catch {
    quotes = new Map();
  }

  const perSymbol = await mapLimit(clean, 4, async (symbol) => {
    const quote = quotes.get(symbol) ?? null;
    const moving = quote !== null && Math.abs(quote.changePct) >= MOVING_CHANGE_PCT;

    const [headlines, filings] = await Promise.all([
      fetchHeadlines(symbol).catch(() => [] as RawHeadline[]),
      getRecent8kFilings(symbol, MAX_FILINGS_PER_SYMBOL).catch(() => [] as SecFilingRow[]),
    ]);

    const items: NewsItem[] = [];
    const seenTitles = new Set<string>();

    let headlineCount = 0;
    for (const headline of sortNewestFirst(headlines)) {
      if (headlineCount >= MAX_HEADLINES_PER_SYMBOL) break;
      if (Date.parse(headline.publishedAt) < cutoff) continue;
      const titleKey = normalizeTitle(headline.title);
      if (!titleKey || seenTitles.has(titleKey)) continue;
      seenTitles.add(titleKey);
      headlineCount += 1;

      const tags = headlineTags(`${headline.title} ${headline.summary ?? ""}`);
      if (moving) tags.push("moving");
      items.push({
        id: stableId(`headline|${symbol}|${headline.link}`),
        symbol,
        kind: "headline",
        title: headline.title,
        link: headline.link,
        source: "Yahoo Finance",
        publishedAt: headline.publishedAt,
        tags: uniqueTags(tags),
        important: false,
        summary: headline.summary,
      });
    }

    for (const filing of filings) {
      const publishedAt = filingPublishedAt(filing.filingDate);
      if (Date.parse(publishedAt) < cutoff) continue;
      const title = `${filing.form} · ${filing.reportDate}`;
      const titleKey = normalizeTitle(title);
      if (!titleKey || seenTitles.has(titleKey)) continue;
      seenTitles.add(titleKey);

      const tags = filingTags(filing.items);
      if (moving) tags.push("moving");
      items.push({
        id: stableId(`filing|${symbol}|${filing.accessionNumber}`),
        symbol,
        kind: "filing",
        title,
        link: filing.url,
        source: "SEC EDGAR",
        publishedAt,
        tags: uniqueTags(tags),
        important: filing.important,
        summary: filingSummary(filing.items),
      });
    }

    return items;
  });

  return sortNewestFirst(perSymbol.flat());
}
