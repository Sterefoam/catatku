/**
 * Catatan risiko ringkas untuk laporan Inspeksi Saham.
 * Fungsi murni — dipakai route `/api/trading/inspect/[symbol]` dan server
 * component halaman inspeksi supaya keduanya menampilkan catatan yang sama.
 *
 * Bahasa: manusiawi, istilah trading dijelaskan sekali dalam kurung.
 */

import { fmtPct, fmtPrice, fmtVolume } from "@/lib/trading/format";
import type { Quote, Technicals } from "@/lib/trading/types";

function plainPct(value: number, digits = 1): string {
  return `${Math.abs(value).toFixed(digits).replace(".", ",")}%`;
}

/** Catatan risiko (bahasa Indonesia) dari harga & teknikal. */
export function buildRiskNotes(quote: Quote, technicals: Technicals): string[] {
  const notes: string[] = [];
  const atrPct = technicals.atrPct;

  if (atrPct !== null && atrPct >= 5) {
    notes.push(
      `Ayunan harga (ATR) tinggi: sekitar ${plainPct(atrPct)} dari harga. Kurangi jumlah lembar dan beri ruang lebih untuk batas rugi (stop).`,
    );
  } else if (atrPct !== null && atrPct >= 3) {
    notes.push(
      `Ayunan harga (ATR) sedang–tinggi: sekitar ${plainPct(atrPct)} dari harga. Jangan pasang batas rugi terlalu rapat.`,
    );
  }

  if (quote.price > 0 && quote.price < 500) {
    notes.push(
      `Harga ${fmtPrice(quote.price)} di bawah $5 — saham murah bisa punya selisih harga beli-jual lebar, jadi order bisa terisi jauh dari harga yang terlihat.`,
    );
  }

  if (technicals.relVolume !== null && technicals.relVolume < 0.7) {
    notes.push(
      `Volume sesi ini hanya ${technicals.relVolume.toFixed(2).replace(".", ",")}× rata-rata 20 hari (${fmtVolume(
        technicals.avgVolume20,
      )} lembar). Saham sedang sepi, harga bisa bergerak mendadak saat order masuk.`,
    );
  }

  const high52 = technicals.high52w ?? (quote.fiftyTwoWeekHigh || null);
  const low52 = technicals.low52w ?? (quote.fiftyTwoWeekLow || null);
  if (high52 !== null && high52 > 0 && quote.price >= high52 * 0.98) {
    notes.push(
      `Harga sudah dekat tertinggi 52 minggu (${fmtPrice(high52)}). Bisa ada penolakan harga dan aksi ambil untung.`,
    );
  }
  if (low52 !== null && low52 > 0 && quote.price <= low52 * 1.02) {
    notes.push(
      `Harga dekat titik terendah 52 minggu (${fmtPrice(low52)}). Tren masih lemah — tunggu konfirmasi sebelum masuk.`,
    );
  }

  if (Math.abs(quote.changePct) >= 5) {
    notes.push(
      `Harga bergerak ${fmtPct(quote.changePct)} hari ini. Jangan mengejar di ujung gerakan; tunggu harga masuk yang jelas.`,
    );
  }

  if (quote.volume === 0) {
    notes.push(
      "Volume sesi ini belum tercatat (mungkin pra/pasca-pasar atau data tertunda). Pastikan ada volume sebelum masuk.",
    );
  }

  // Tanggal earnings tidak tersedia dari sumber gratis ini; katakan apa adanya.
  notes.push(
    "Tanggal rilis laba (earnings) berikutnya tidak tersedia dari sumber gratis ini — cek kalender emiten sebelum menahan posisi semalam.",
  );

  return notes;
}
