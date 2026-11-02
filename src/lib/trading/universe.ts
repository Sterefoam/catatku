/**
 * Daftar semesta pemindaian (universe) untuk scanner & pencarian cepat.
 *
 * Daftar ini adalah kurasi saham AS paling likuid (bukan rekomendasi, bukan
 * indeks resmi). Scanner juga bisa memakai watchlist pengguna atau simbol
 * yang disebut langsung.
 */

export interface UniverseSymbol {
  symbol: string;
  name: string;
  sector: string;
}

export const UNIVERSE_SP100: UniverseSymbol[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Teknologi" },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Teknologi" },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Semikonduktor" },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "E-commerce" },
  { symbol: "GOOGL", name: "Alphabet Inc. (Class A)", sector: "Internet" },
  { symbol: "META", name: "Meta Platforms Inc.", sector: "Internet" },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Otomotif" },
  { symbol: "AVGO", name: "Broadcom Inc.", sector: "Semikonduktor" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Perbankan" },
  { symbol: "V", name: "Visa Inc.", sector: "Pembayaran" },
  { symbol: "MA", name: "Mastercard Inc.", sector: "Pembayaran" },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Kesehatan" },
  { symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energi" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Kesehatan" },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Retail" },
  { symbol: "PG", name: "Procter & Gamble", sector: "Konsumen" },
  { symbol: "HD", name: "Home Depot Inc.", sector: "Retail" },
  { symbol: "COST", name: "Costco Wholesale", sector: "Retail" },
  { symbol: "ORCL", name: "Oracle Corp.", sector: "Perangkat lunak" },
  { symbol: "NFLX", name: "Netflix Inc.", sector: "Media" },
  { symbol: "BAC", name: "Bank of America", sector: "Perbankan" },
  { symbol: "KO", name: "Coca-Cola Co.", sector: "Konsumen" },
  { symbol: "PEP", name: "PepsiCo Inc.", sector: "Konsumen" },
  { symbol: "TMO", name: "Thermo Fisher Scientific", sector: "Kesehatan" },
  { symbol: "ABBV", name: "AbbVie Inc.", sector: "Farmasi" },
  { symbol: "CRM", name: "Salesforce Inc.", sector: "Perangkat lunak" },
  { symbol: "ADBE", name: "Adobe Inc.", sector: "Perangkat lunak" },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Semikonduktor" },
  { symbol: "MRK", name: "Merck & Co.", sector: "Farmasi" },
  { symbol: "CVX", name: "Chevron Corp.", sector: "Energi" },
  { symbol: "LLY", name: "Eli Lilly & Co.", sector: "Farmasi" },
  { symbol: "PFE", name: "Pfizer Inc.", sector: "Farmasi" },
  { symbol: "DIS", name: "Walt Disney Co.", sector: "Media" },
  { symbol: "CSCO", name: "Cisco Systems", sector: "Teknologi" },
  { symbol: "INTC", name: "Intel Corp.", sector: "Semikonduktor" },
  { symbol: "QCOM", name: "Qualcomm Inc.", sector: "Semikonduktor" },
  { symbol: "TXN", name: "Texas Instruments", sector: "Semikonduktor" },
  { symbol: "IBM", name: "IBM Corp.", sector: "Teknologi" },
  { symbol: "GE", name: "GE Aerospace", sector: "Industri" },
  { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industri" },
  { symbol: "BA", name: "Boeing Co.", sector: "Industri" },
  { symbol: "MCD", name: "McDonald's Corp.", sector: "Restoran" },
  { symbol: "NKE", name: "Nike Inc.", sector: "Konsumen" },
  { symbol: "SBUX", name: "Starbucks Corp.", sector: "Restoran" },
  { symbol: "PYPL", name: "PayPal Holdings", sector: "Pembayaran" },
  { symbol: "SHOP", name: "Shopify Inc.", sector: "E-commerce" },
  { symbol: "UBER", name: "Uber Technologies", sector: "Transportasi" },
  { symbol: "ABNB", name: "Airbnb Inc.", sector: "Travel" },
  { symbol: "COIN", name: "Coinbase Global", sector: "Kripto" },
  { symbol: "PLTR", name: "Palantir Technologies", sector: "Perangkat lunak" },
  { symbol: "SNOW", name: "Snowflake Inc.", sector: "Perangkat lunak" },
  { symbol: "DDOG", name: "Datadog Inc.", sector: "Perangkat lunak" },
  { symbol: "CRWD", name: "CrowdStrike Holdings", sector: "Perangkat lunak" },
  { symbol: "PANW", name: "Palo Alto Networks", sector: "Perangkat lunak" },
  { symbol: "NOW", name: "ServiceNow Inc.", sector: "Perangkat lunak" },
  { symbol: "INTU", name: "Intuit Inc.", sector: "Perangkat lunak" },
  { symbol: "AMAT", name: "Applied Materials", sector: "Semikonduktor" },
  { symbol: "MU", name: "Micron Technology", sector: "Semikonduktor" },
  { symbol: "LRCX", name: "Lam Research", sector: "Semikonduktor" },
  { symbol: "ADI", name: "Analog Devices", sector: "Semikonduktor" },
  { symbol: "BKNG", name: "Booking Holdings", sector: "Travel" },
  { symbol: "ISRG", name: "Intuitive Surgical", sector: "Kesehatan" },
  { symbol: "VRTX", name: "Vertex Pharmaceuticals", sector: "Farmasi" },
  { symbol: "REGN", name: "Regeneron Pharmaceuticals", sector: "Farmasi" },
  { symbol: "GILD", name: "Gilead Sciences", sector: "Farmasi" },
  { symbol: "AMGN", name: "Amgen Inc.", sector: "Farmasi" },
  { symbol: "MRNA", name: "Moderna Inc.", sector: "Farmasi" },
  { symbol: "CVS", name: "CVS Health Corp.", sector: "Kesehatan" },
  { symbol: "WFC", name: "Wells Fargo & Co.", sector: "Perbankan" },
  { symbol: "GS", name: "Goldman Sachs Group", sector: "Perbankan" },
  { symbol: "MS", name: "Morgan Stanley", sector: "Perbankan" },
  { symbol: "C", name: "Citigroup Inc.", sector: "Perbankan" },
  { symbol: "SCHW", name: "Charles Schwab Corp.", sector: "Perbankan" },
  { symbol: "BLK", name: "BlackRock Inc.", sector: "Manajer aset" },
  { symbol: "AXP", name: "American Express", sector: "Pembayaran" },
  { symbol: "SPGI", name: "S&P Global Inc.", sector: "Data keuangan" },
  { symbol: "MMC", name: "Marsh & McLennan", sector: "Asuransi" },
  { symbol: "LIN", name: "Linde plc", sector: "Material" },
  { symbol: "SHW", name: "Sherwin-Williams", sector: "Material" },
  { symbol: "FCX", name: "Freeport-McMoRan", sector: "Tambang" },
  { symbol: "NEM", name: "Newmont Corp.", sector: "Tambang" },
  { symbol: "OXY", name: "Occidental Petroleum", sector: "Energi" },
  { symbol: "SLB", name: "SLB (Schlumberger)", sector: "Energi" },
  { symbol: "HAL", name: "Halliburton Co.", sector: "Energi" },
  { symbol: "F", name: "Ford Motor Co.", sector: "Otomotif" },
  { symbol: "GM", name: "General Motors Co.", sector: "Otomotif" },
  { symbol: "RIVN", name: "Rivian Automotive", sector: "Otomotif" },
  { symbol: "LCID", name: "Lucid Group", sector: "Otomotif" },
  { symbol: "NIO", name: "NIO Inc. (ADR)", sector: "Otomotif" },
  { symbol: "TSM", name: "Taiwan Semiconductor (ADR)", sector: "Semikonduktor" },
  { symbol: "BABA", name: "Alibaba Group (ADR)", sector: "E-commerce" },
  { symbol: "JD", name: "JD.com (ADR)", sector: "E-commerce" },
  { symbol: "PDD", name: "PDD Holdings (ADR)", sector: "E-commerce" },
  { symbol: "SE", name: "Sea Limited (ADR)", sector: "E-commerce" },
  { symbol: "MELI", name: "MercadoLibre Inc.", sector: "E-commerce" },
  { symbol: "ARM", name: "Arm Holdings (ADR)", sector: "Semikonduktor" },
  { symbol: "SMCI", name: "Super Micro Computer", sector: "Perangkat keras" },
  { symbol: "DELL", name: "Dell Technologies", sector: "Perangkat keras" },
  { symbol: "HPQ", name: "HP Inc.", sector: "Perangkat keras" },
  { symbol: "VZ", name: "Verizon Communications", sector: "Telekomunikasi" },
  { symbol: "T", name: "AT&T Inc.", sector: "Telekomunikasi" },
  { symbol: "TMUS", name: "T-Mobile US", sector: "Telekomunikasi" },
  { symbol: "CMCSA", name: "Comcast Corp.", sector: "Media" },
  { symbol: "CHTR", name: "Charter Communications", sector: "Media" },
];

export const UNIVERSE_MEGA: UniverseSymbol[] = UNIVERSE_SP100.slice(0, 20);

export type UniverseKey = "sp100" | "mega" | "watchlist" | "symbols";

export function universeSymbols(key: UniverseKey): UniverseSymbol[] {
  if (key === "mega") return UNIVERSE_MEGA;
  return UNIVERSE_SP100;
}

export function universeLabel(key: string): string {
  if (key === "mega") return "20 saham mega-cap";
  if (key === "watchlist") return "Watchlist saya";
  if (key === "symbols") return "Simbol pilihan";
  return "100 saham AS paling likuid (kurasi)";
}

export function findUniverseSymbol(symbol: string): UniverseSymbol | null {
  const clean = symbol.trim().toUpperCase();
  return (
    UNIVERSE_SP100.find((row) => row.symbol === clean) ??
    UNIVERSE_MEGA.find((row) => row.symbol === clean) ??
    null
  );
}
