# Panduan bahasa & prioritas UI — Meja Trading

Dokumen kerja untuk penyempurnaan Meja Trading (putaran 2). Tujuannya:
**bahasa yang mudah dimengerti pemula** dan **informasi penting tampil dulu,
detail lanjutan dilipat**. Ikuti persis supaya konsisten dengan dashboard.

## 1. Aturan bahasa

1. **Sapaan netral & santai**, kalimat pendek (maks ±12 kata per baris).
   Contoh: "Harga masuk" bukan "Entry trigger price".
2. **Istilah trading boleh, tapi jelaskan sekali** dalam tanda kurung pada
   kemunculan pertama: "stop (batas rugi)", "target (ambil untung)",
   "R:R (imbalan dibanding risiko)", "opening range (rentang 15 menit pertama)",
   "paper trading (latihan tanpa uang sungguhan)".
3. **Jangan pakai kata ini**: notional, trigger, pemicu, size, exposure,
   drawdown, liquidity, real-time, order flow. Ganti dengan bahasa manusia:
   - trigger/pemicu → **harga masuk**
   - notional → **nilai beli**
   - size → **jumlah lembar**
   - real-time → **harga terakhir**
4. **Angka selalu konkret & diberi arti.** Contoh:
   - "Kerugian kalau kena stop: **$18,03**" (bukan "Risiko total")
   - "Butuh naik **2 kali** dari risiko untuk sampai target"
   - "Jumlah lembar: **3** (nilai beli $1.200,18)"
5. **Jangan menjanjikan apa pun.** Dilarang: "pasti untung", "dijamin",
   "sinyal akurat", "pasti naik". Pakai "cocok dengan aturan", "peluang".
   Selalu ingatkan: latihan uang kertas, bukan saran finansial.
6. **Data gratis bisa tertunda** — sebut sekali per halaman, jangan diulang
   di setiap kartu.
7. Bahasa Indonesia baku santai: "kamu", "bisa", "coba", bukan "Anda" atau
   campuran Inggris ("update", "settings", "check").
8. Emoji tidak dipakai di UI (kecuali sudah ada pola sebelumnya).
9. Tooltip/`hint` maksimal 1 baris, isinya contoh nyata.
10. Semua tombol = kata kerja: "Simpan rencana", "Isi order", "Hitung jumlah
    lembar", "Buat alert".

## 2. Glosarium label (pakai konsisten)

| Istilah | Label UI | Penjelasan singkat |
| --- | --- | --- |
| Entry | **Harga masuk** | Harga yang harus ditembus untuk mulai |
| Stop | **Batas rugi (stop)** | Keluar kalau harga turun sampai sini |
| Target | **Target untung** | Ambil untung di harga ini |
| Flat by | **Jam keluar** | Semua posisi ditutup pukul 15:55 ET |
| Position size / qty | **Jumlah lembar** | Saham yang dibeli |
| Risk per share | **Rugi per lembar** | Selisih harga masuk dan batas rugi |
| R:R | **Imbalan : risiko** | 2R = untung 2× kerugian |
| Paper trading | **Latihan (uang kertas)** | Tidak ada uang sungguhan |
| Watchlist | **Daftar pantau** | Saham yang kamu pantau |
| Alerts | **Pengingat harga** | Bunyi saat harga menyentuh level |
| Scanner | **Cari setup** | Mencari saham yang cocok aturan |
| Inspect | **Periksa saham** | Laporan lengkap satu saham |
| Opening range | **Rentang awal** | High/low 15 menit pertama (09.30–09.45 ET) |
| ATR | **Ayunan harga (ATR)** | Rata-rata gerak harga 14 hari |

## 3. Format angka

- Harga saham (sen): pakai `fmtPrice` → `$399.81` (jangan campur "US$").
- Angka dolar besar (fundamental): pakai `fmtUsdCompact` → `$103,6 miliar`,
  `$787 juta` (bukan "M"/"jt" yang ambigu).
- Dolar desimal kecil (EPS): `fmtUsdDollars` → `$0,22`.
- Persen: `fmtPct` → `+1,25%` / `−4,22%`.
- R: `fmtR` → `2,0R` dan ditulis "2 kali risiko" di teks penjelasan.

## 4. Prioritas informasi (penting → dilipat)

**Penting — selalu terlihat tanpa klik:**
1. Harga terakhir + perubahan hari ini.
2. Satu kalimat kesimpulan: "Cocok aturan X, harga di atas rata-rata 20 hari."
3. Tombol utama: **Buat rencana** (dari inspeksi) / **Hitung & simpan** (dari rencana).
4. Rencana aktif: harga masuk, batas rugi, target, jumlah lembar, jam keluar.
5. Posisi/order yang sedang berjalan & alert aktif.
6. Batas risiko yang dipakai: rugi maksimal per trade & per hari.

**Pendukung — tampil ringkas, boleh dilipat:**
- Berita penting + 8-K (3 item teratas, tombol "Lihat semua").
- Grafik intraday & 3 bulan (grafik tetap penting; beri label jelas).
- Pengaturan inti (modal, rugi/trade, trade/hari, jam).

**Lanjutan — SELALU di dalam `<Disclosure>` (tertutup default):**
- Detail teknikal (RSI, MA20/50, ATR, rel. volume).
- Fundamental SEC (tabel kuartal, margin, TTM).
- Aturan stop/target sendiri (persen/ATR/harga manual), Time Machine.
- Pengaturan lanjutan (ukuran posisi maks, nilai order maks, buffer kas,
  batas rugi harian, min R:R, universe pemindai).
- Pemilihan universe pemindai (default: 100 saham likuid).

Gunakan komponen bersama:

```tsx
import { Disclosure } from "@/components/trading/ui";

<Disclosure title="Detail teknikal" hint="RSI, rata-rata harga, ayunan harga">
  …
</Disclosure>
```

## 5. Struktur yang diharapkan per halaman

- **/trading (dashboard, Lead)**: kotak pencarian paling atas → status pasar &
  sisa risiko ringkas → rencana aktif + posisi → daftar pantau → pengingat.
  Pindai & pengaturan jadi tautan kecil, bukan kartu besar.
- **/trading/inspeksi/[symbol] (inspector)**: harga + 1 kalimat kesimpulan →
  tombol Buat rencana/Daftar pantau/Pengingat → grafik → setup → berita 3 item →
  `<Disclosure>` detail teknikal → `<Disclosure>` fundamental → catatan risiko.
- **/trading/scan (scan)**: 2 pilihan mode + tombol Cari sekarang → hasil.
  Universe & penjelasan cara kerja masuk `<Disclosure>`.
- **/trading/rencana (desk)**: form inti (saham, harga masuk, batas rugi
  pilihan cepat, target pilihan cepat) → tombol "Hitung rencana" → ringkasan
  bahasa manusia → simpan → daftar rencana. Aturan sendiri & Time Machine di
  `<Disclosure>`.
- **/trading/posisi**: ringkasan (posisi terbuka, order menunggu, hasil hari
  ini) → daftar order dengan tombol jelas → jurnal.
- **/trading/alert**: tombol preset 3 pengingat dari rencana aktif → daftar →
  form pengingat khusus di `<Disclosure>`.
- **/trading/pengaturan**: "Penting" (modal, rugi maks/trade, trade/hari, jam
  masuk, jam keluar) → `<Disclosure>` "Lanjutan" untuk sisanya.

## 6. Definition of done putaran ini

- Tidak ada teks Inggris placeholder, tidak ada singkatan ambigu (M, jt, R
  tanpa penjelasan).
- Setiap halaman muat di 390px tanpa geser horizontal; mode gelap nyaman.
- Semua state: ada data, kosong, loading, dan error tampil wajar.
- `npx tsc --noEmit` bersih untuk file masing-masing.
- Laporkan ke Lead: file, perubahan bahasa, bug yang diperbaiki, hasil uji.
