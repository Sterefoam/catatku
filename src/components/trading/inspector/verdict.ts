/**
 * Satu kalimat kesimpulan bahasa manusia untuk halaman Inspeksi Saham.
 *
 * Contoh hasil:
 * "Harga di atas rata-rata 20 hari, ayunan harga 3,6% — 1 pola cocok aturan,
 *  rencana hari ini."
 *
 * Murni (tanpa fetch), bisa dipakai server & client.
 */

import type { MarketStatus, Quote, SetupTag, Technicals } from "@/lib/trading/types";

function plainPct(value: number, digits = 1): string {
  return `${Math.abs(value).toFixed(digits).replace(".", ",")}%`;
}

function windowPhrase(market: MarketStatus | null | undefined): string {
  if (!market) return "rencana hari ini";
  switch (market.state) {
    case "open":
    case "premarket":
      return "rencana hari ini";
    case "afterhours":
      return "rencana besok";
    default:
      return "rencana sesi berikutnya";
  }
}

/**
 * Kalimat ringkas: posisi harga terhadap rata-rata 20 hari + besar ayunan
 * harga + apakah ada pola yang cocok aturan.
 */
export function buildVerdict({
  quote,
  technicals,
  setups,
  market,
}: {
  quote: Quote;
  technicals: Technicals;
  setups: SetupTag[];
  market?: MarketStatus | null;
}): string {
  const parts: string[] = [];

  if (technicals.sma20 !== null && technicals.sma20 > 0) {
    parts.push(
      quote.price >= technicals.sma20
        ? "Harga di atas rata-rata 20 hari"
        : "Harga di bawah rata-rata 20 hari",
    );
  }

  if (technicals.atrPct !== null) {
    parts.push(`ayunan harga ${plainPct(technicals.atrPct)}`);
  }

  if (parts.length === 0) {
    return "Data teknikal belum cukup untuk kesimpulan — buka Detail teknikal untuk angka mentahnya.";
  }

  const patternPhrase =
    setups.length > 0
      ? `${setups.length} pola cocok aturan`
      : "belum ada pola yang cocok";
  const window = setups.length > 0 ? `, ${windowPhrase(market)}` : ", tunggu konfirmasi";

  return `${parts.join(", ")} — ${patternPhrase}${window}.`;
}
