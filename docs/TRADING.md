# MEJA TRADING — kontrak kerja modul Trading (baca dulu)

Modul baru di aplikasi Catatku: **Meja Trading** — setup trading + inspeksi saham
untuk saham AS, diadaptasi dari paket skill `dsh-day-trader-skills`
(scanner, news, entry, exit, timemachine, risk, budget, broker, alerts,
analyst). Semuanya **paper trading**, edukasi, bukan saran finansial.

Baca juga `docs/FOUNDATION.md` (aturan proyek: desain, npm, jangan jalankan
build/dev sendiri).

## Prinsip yang tidak boleh dilanggar

1. **Bahasa UI: Indonesia** yang ramah & ringkas. Tidak ada teks Inggris
   placeholder. Istilah trading boleh tetap (entry, stop, target, R).
2. **Semua harga dalam SEN (integer USD)**: `$364.18` = `36418`. Tipe DTO di
   `src/lib/trading/types.ts`. Tampilkan dengan `formatMoney(cents, "USD")`
   atau helper di `src/lib/trading/format.ts`.
3. **Data server-side saja.** Semua pengambilan Yahoo/SEC/RSS lewat route
   handler atau server component. Jangan panggil Yahoo dari browser.
4. **Bilang apa adanya**: kutipan dari Yahoo gratis & bisa tertunda
   ("data gratis, bisa tertunda"), tidak pernah "real time". Scanner menulis
   "cocok dengan aturan", bukan "beli".
5. **Paper only.** Tidak ada integrasi broker nyata, tidak ada kunci API.
   Order = order kertas yang dicatat di DB.
6. **Jangan menjalankan `npm install`, `npm run build`, `npm run dev`, atau
   migrasi DB.** Lead yang mengurus itu. Tulis kode dengan benar, laporkan.
7. **Hanya tulis file di scope milikmu** (lihat tabel). Butuh perubahan file
   bersama → kirim pesan ke Lead.
8. Desain mengikuti Catatku: kartu `rounded-3xl`, `border-border/80`,
   `bg-card`, aksen emerald (`text-primary`, `bg-primary-soft`), hijau untuk
   naik (`text-success`), merah untuk turun (`text-danger`), teks sekunder
   `text-muted-foreground`. Angka harga pakai kelas `money` (tabular-nums).
   Mobile-first, siap desktop, mode gelap aman (jangan hardcode warna terang).
9. **Jangan pakai library chart.** Gambar grafik sendiri dengan SVG/div
   (contoh: `src/components/trading/ui.tsx` sudah berisi `Sparkline`).
10. Elemen interaktif minimal 40px, label form jelas, `aria-*` pada kontrol.

## Scope file (WAJIB dipatuhi)

| Area | Pemilik | File |
| --- | --- | --- |
| Fondasi & dashboard | **Lead** | `src/lib/trading/{types,market-clock,yahoo,technicals,universe,data,format}.ts`, `src/components/trading/ui.tsx`, `src/components/trading/dashboard/**`, `src/app/(app)/trading/page.tsx`, `src/app/api/trading/{settings,quote,search,watchlist}/**` |
| Scanner + engine | **engine** | `src/lib/trading/{scan,plan-engine,timemachine}.ts`, `src/app/api/trading/{scan,timemachine,entry}/route.ts`, `src/app/(app)/trading/scan/page.tsx`, `src/components/trading/scan/**` |
| Inspeksi saham | **inspector** | `src/lib/trading/{news,sec}.ts`, `src/app/api/trading/{inspect/[symbol],news,fundamentals/[symbol]}/route.ts`, `src/app/(app)/trading/inspeksi/**`, `src/components/trading/inspector/**` |
| Meja transaksi | **desk** | `src/app/api/trading/{plans,plans/[id],orders,orders/[id],alerts,alerts/[id],alerts/check}/route.ts`, `src/app/(app)/trading/{rencana,posisi,alert,pengaturan}/page.tsx`, `src/components/trading/desk/**` |
| Integrasi, build, QA, docs | **Lead** | shell/nav, seed demo, README, docs, screenshot |

Jangan menyentuh file pemilik lain, `src/app/globals.css`,
`src/components/ui/*`, `src/components/app/*`, `src/lib/{money,date,api,auth,db}/*`,
`package.json`, `next.config.ts`, `drizzle/**` (kecuali Lead).

## Pustaka bersama yang sudah ada (pakai, jangan duplikasi)

```ts
// src/lib/trading/types.ts  (semua tipe DTO)
// src/lib/trading/market-clock.ts
marketStatus(now?): MarketStatus
getEtParts(now?): { dateISO, minutes, weekday, iso }
etWallToDate(dateISO, minutes): Date
hhmmToMinutes("09:45"): number; minutesToHHMM(570): string
isTradingDay(dateISO); isEarlyClose(dateISO); closeMinutesFor(dateISO)
flatByFor(dateISO, "15:55"): string
etTimeLabel(iso): "10:15 ET"; etDateOf(iso): "YYYY-MM-DD"
MARKET_OPEN_MINUTES, MARKET_CLOSE_MINUTES, EARLY_CLOSE_MINUTES, MARKET_HOLIDAYS

// src/lib/trading/yahoo.ts  (server-only)
fetchChart(symbol, range?, interval?): Promise<CandleSeries | null>   // range default "3mo", interval "1d"
fetchQuotes(symbols: string[]): Promise<Map<string, Quote>>
fetchQuote(symbol): Promise<Quote | null>
searchSymbols(q): Promise<SymbolSearchResult[]>
mapLimit(items, limit, worker); cached(key, ttlMs, loader); toCents(n); fromCents(c)
QUOTE_TTL_MS, INTRADAY_TTL_MS, DAILY_TTL_MS

// src/lib/trading/technicals.ts
analyze({ symbol, daily, intraday, quote, nowMs? }): { technicals, setups }
detectDailySetups(bars): SetupTag[]
detectOrb(bars5m, minutes?, nowMs?): { hit, when, price, level, range }
openingRange(bars5m, minutes?, nowMs?): OpeningRange | null
rsi14(closes), sma(values, n), atr14(bars), lastSessionBars(bars)
isBarComplete(bar, intervalSeconds, nowMs?), minimumStopDistance(entry)

// src/lib/trading/universe.ts
UNIVERSE_SP100: {symbol,name,sector}[]; UNIVERSE_MEGA
universeSymbols(key); universeLabel(key); findUniverseSymbol(symbol)

// src/lib/trading/data.ts  (server-only, DB)
ensureTradingSettings(userId); getTradingSettings(userId); updateTradingSettings(userId, patch)
listWatchlist(userId); addWatchlistItem(userId, symbol, opts?); removeWatchlistItem(userId, symbol); watchlistSymbols(userId)
createPlan(userId, input); listPlans(userId, statuses?); getPlan(userId, id); updatePlan(userId, id, patch); deletePlan(userId, id)
createOrder(userId, input); listOrders(userId, limit?); getOrder(userId, id); updateOrder(userId, id, patch)
listAlerts(userId); createAlert(userId, input); updateAlert(userId, id, patch); deleteAlert(userId, id)
getTradingStats(userId, settings): Promise<TradingStats>
DEFAULT_TRADING_SETTINGS, toTradingSettingsDTO(row)

// src/lib/trading/format.ts  (client-safe)
fmtPrice(cents): "$364.18"; fmtUsd(cents); fmtCentsSigned(cents); fmtPct(n, opts?)
fmtR(n); fmtVolume(n); fmtQty(n)
```

## Konvensi route API

- Semua route: `import { requireApiUser, jsonOk, jsonError, readJson, validationError } from "@/lib/api"`.
  Pola: `const auth = await requireApiUser(); if (auth.response) return auth.response; const user = auth.user;`
- Error: `jsonError("pesan Indonesia", status, details?)`, validasi Zod → `validationError(error)`.
- `export const dynamic = "force-dynamic";` untuk route yang membaca sesi/DB.
- Body JSON; respons `{ ...DTO }` (bentuk bebas asal terdokumentasi di bawah dan
  cocok dengan tipe di `types.ts`).
- Harga di body/response selalu SEN (integer).

### API milik Lead (sudah tersedia — pakai)

| Method | Path | Body/query | Respons |
| --- | --- | --- | --- |
| GET | `/api/trading/settings` | – | `{ settings, stats, market }` |
| PUT | `/api/trading/settings` | partial `TradingSettings` | `{ settings }` |
| GET | `/api/trading/quote` | `?symbols=TSLA,NVDA` | `{ quotes: Quote[] }` |
| GET | `/api/trading/search` | `?q=apple` | `{ results: SymbolSearchResult[] }` |
| GET | `/api/trading/watchlist` | – | `{ items: WatchlistItemDTO[] }` |
| POST | `/api/trading/watchlist` | `{ symbol }` | `{ item }` (201) |
| DELETE | `/api/trading/watchlist` | `?symbol=TSLA` | `{ ok: true }` |

### API milik **engine**

| Method | Path | Body/query | Respons |
| --- | --- | --- | --- |
| GET | `/api/trading/scan` | `?mode=daily|orb&universe=sp100|mega|watchlist|symbols&symbols=TSLA,NVDA&limit=100` | `{ scan: ScanResult }` |
| GET | `/api/trading/entry` | `?symbol=TSLA&setup=orb|level&level=36418&minutes=15` | `{ trigger: TriggerState }` |
| POST | `/api/trading/timemachine` | `{ symbol, entry, stop, target }` (sen) | `{ sim: TimeMachineResult }` |

Scan: `daily` = 5 setup harian dari tutup harian (butuh minimal 1 bulan bar
harian; gunakan `fetchChart(symbol, "3mo", "1d")`), `orb` = tembus opening
range 15 menit pada bar 5 menit (`fetchChart(symbol, "1d", "5m")`). Hasil
ditulis ke DB tidak wajib; scanner hanya mengembalikan hasil. Batasi jumlah
simbol (default universe "sp100" ~100, concurrency 6) dan hormati parameter
`limit` (maks 100). Tandai `partial` bila ada simbol gagal.

### API milik **inspector**

| Method | Path | Body/query | Respons |
| --- | --- | --- | --- |
| GET | `/api/trading/inspect/[symbol]` | – | `{ inspect: InspectDTO }` |
| GET | `/api/trading/news` | `?symbols=TSLA,NVDA&hours=48` | `{ items: NewsItem[] }` |
| GET | `/api/trading/fundamentals/[symbol]` | – | `{ fundamentals: FundamentalsDTO, filings: FilingItem[] }` |

### API milik **desk**

| Method | Path | Body/query | Respons |
| --- | --- | --- | --- |
| POST | `/api/trading/plans/preview` | `PlanDraft` | `{ preview: PlanPreview }` |
| POST | `/api/trading/plans` | `PlanDraft & { note? }` | `{ plan: TradePlanDTO }` (201) |
| GET | `/api/trading/plans` | `?status=active` | `{ plans: TradePlanDTO[] }` |
| PATCH | `/api/trading/plans/[id]` | `{ status?, note?, entry? }` | `{ plan }` |
| DELETE | `/api/trading/plans/[id]` | – | `{ ok: true }` |
| GET | `/api/trading/orders` | – | `{ orders: OrderDTO[], stats: TradingStats }` |
| POST | `/api/trading/orders` | `{ planId }` | `{ order: OrderDTO }` (201) |
| PATCH | `/api/trading/orders/[id]` | `{ action: "fill"|"close"|"cancel", price? }` | `{ order, stats }` |
| GET | `/api/trading/alerts` | – | `{ alerts: AlertDTO[] }` |
| POST | `/api/trading/alerts` | `{ symbol, kind, level?, pct? }` | `{ alert }` (201) |
| PATCH | `/api/trading/alerts/[id]` | `{ isActive? }` | `{ alert }` |
| DELETE | `/api/trading/alerts/[id]` | – | `{ ok: true }` |
| POST | `/api/trading/alerts/check` | – | `{ triggered: AlertDTO[], checkedAt, prices }` |

Aturan order kertas:
- `POST /orders` butuh plan `active`/`triggered`, qty > 0, dan **cek risiko ulang**
  (`computePlan` + `getTradingStats`); tolak bila ada check `fail` dengan 422
  `jsonError(alasan)`. Order tersimpan `status: "pending"`.
- `action=fill`: isi `filledPrice` = harga pasar terakhir (atau `price`),
  status `filled`, `filledAt` sekarang; tolak bila bukan pending.
- `action=close` (dari pending juga boleh = batal isi): isi `closedPrice`,
  `closedAt`, `exitReason` (`stop` bila `price <= stop`, `target` bila
  `price >= target`, selain itu `manual`), `status: "closed"`,
  `pnl = (closedPrice - entry) * qty`.
- `action=cancel`: status `cancelled` (hanya dari `pending`).
- Alert `kind`: `above|below` pakai `level`; `pct` pakai `pct`; `stop|target`
  pakai `level`; `bell|flat-by` tanpa level. `label` diisi otomatis oleh server
  Indonesia (mis. "TSLA di atas $364.18").

### Engine fungsi yang wajib diekspor (dipakai **desk**)

```ts
// src/lib/trading/plan-engine.ts  (murni + boleh fetch quote/ATR di route)
export interface PlanContext {
  quote: Quote | null;
  atr14: number | null;
  openingRange: OpeningRange | null;
  market: MarketStatus;
  stats: TradingStats;
}
export function computePlan(
  input: PlanDraft,
  settings: TradingSettings,
  context: PlanContext,
): PlanPreview;
```
`computePlan` melakukan: hitung stop menurut `stopRule` (`or-mid`, `or-low`,
`price`, `pct`, `atr`), target menurut `targetRule` (`1R`, `1.5R`, `2R`,
`price`), pembulatan (stop ke bawah, target ke atas, sen), ukuran posisi dengan
4 limit (max loss, max position, max order, kas setelah buffer), lalu daftar
`checks` (RiskCheckItem): stop wajib, risiko ≤ max loss, R:R ≥ min, risiko
harian muat, jumlah trade harian, jam entry, pasar buka, harga wajar, volume.
`ok = tidak ada check "fail"`. `errors` berisi alasan penolakan (string).
Stop terlalu dekat (< 0,05% harga) = error. Entry ≤ 0 / stop ≥ entry = error.

**Encoding parameter stop (diputuskan Lead, dipakai desk & engine):** parameter
dikirim lewat `stopPrice` sesuai `stopRule`:
- `price` → `stopPrice` = harga stop dalam SEN.
- `pct` → `stopPrice` = persen × 100 (1,5% = `150`); stop = entry − entry × pct/100.
- `atr` → `stopPrice` = kelipatan × 100 (1,5×ATR = `150`); stop = entry − atr14 × kelipatan.
- `or-mid` / `or-low` → `stopPrice` diabaikan, pakai `context.openingRange`
  (fallback `input.orHigh`/`input.orLow`).

```ts
// src/lib/trading/timemachine.ts
export function simulatePlan(opts: {
  symbol: string; entry: number; stop: number; target: number;
  bars: Bar[];            // bar 5 menit ~60 hari (engine yang fetch)
  simulations?: number;   // default 2000
}): TimeMachineResult;
```

## DB (untuk referensi; helper di `src/lib/trading/data.ts`)

Tabel: `trading_settings`, `watchlist_items`, `trade_plans`, `paper_orders`,
`price_alerts` — semua memakai `user_id`, harga INTEGER sen. Migrasi sudah
ditulis Lead (`drizzle/0002_meja_trading.sql`) dan dijalankan otomatis.

## Rute halaman & pola UI

Semua halaman di bawah `src/app/(app)/trading/**` (otomatis wajib login).
Gunakan `PageHeader` (`backHref="/trading"`, `eyebrow="Meja Trading"`),
`Card`, `Button`, `Segmented`, `Badge`, `EmptyState`, `Dialog` dari
`src/components/ui/*`. Data awal dari server component (langsung panggil
`data.ts`/lib), aksi interaktif lewat `fetch` + `toast` + `router.refresh()`.

- `/trading` (Lead): ringkasan pasar, anggaran risiko, watchlist, rencana aktif,
  posisi paper, alert, pintasan ke Inspeksi/Scan/Rencana.
- `/trading/scan` (engine): pilih mode & universe, tombol "Pindai sekarang",
  hasil tabel/kartu; tombol "Inspeksi" & "Tambah watchlist" & "Buat rencana".
- `/trading/inspeksi` (inspector): kotak cari simbol (pakai `/api/trading/search`)
  + daftar watchlist.
- `/trading/inspeksi/[symbol]` (inspector): laporan lengkap — harga, grafik
  intraday & harian (SVG), teknikal, setup, berita + 8-K, fundamental SEC,
  catatan risiko; tombol "Buat rencana" (`/trading/rencana?symbol=TSLA`) dan
  "Tambah watchlist".
- `/trading/rencana` (desk): form setup (simbol, jenis, harga pemicu, stop,
  target) + cek pemicu live + pratinjau rencana + order kertas; daftar rencana.
- `/trading/posisi` (desk): posisi & order paper, tutup posisi, statistik
  risiko hari ini, jurnal.
- `/trading/alert` (desk): buat alert + daftar + cek manual (polling 30 detik
  saat halaman terbuka, notifikasi browser bila diizinkan).
- `/trading/pengaturan` (desk): form anggaran risiko & jam sesi.

Tautan silang antar halaman wajib ada (mis. dari dashboard → semua halaman).

## Definition of done

- `npx tsc --noEmit` tidak menambah error baru di file milikmu.
- Halaman bisa dibuka (200), ada state kosong/loading/error, mobile & desktop.
- Tidak ada fetch Yahoo/SEC dari client, tidak ada teks Inggris placeholder.
- Laporkan ke Lead: file yang dibuat, endpoint yang dicoba, hasil `curl`,
  dan hal yang belum selesai.

---

## Status implementasi (2 November 2026)

Modul **selesai dan terverifikasi** di build produksi (Next.js 15, `next start`).

| Bagian | Hasil |
| --- | --- |
| Pustaka inti | `market-clock`, `yahoo`, `technicals`, `universe`, `data`, `format`, `scan`, `plan-engine`, `timemachine`, `news`, `sec` |
| API | 16 route `src/app/api/trading/**` (settings, quote, search, watchlist, scan, entry, timemachine, inspect, news, fundamentals, plans, orders, alerts) |
| Halaman | 7 halaman `src/app/(app)/trading/**` + 22 komponen `src/components/trading/**` |
| DB | 5 tabel baru, migrasi `drizzle/0002_meja_trading.sql` (lokal + Turso) |
| Typecheck | `tsc --noEmit` bersih (0 error) |
| QA browser | 8 halaman 200, 0 overflow (390px & 1440px), 0 error console; alur interaktif 11/11 lulus |
| Build | `npm run build` sukses — 69 route (21 halaman + 46 API) |

### Catatan penting

- **Semantik cek pasar**: check `market` berstatus `fail` hanya bila bursa benar-benar
  tutup (weekend/libur); pra-pasar & pasca-pasar = `warn`, jadi rencana tetap boleh
  disusun di luar jam. Order kertas baru ditolak (`422`) saat di luar jendela entry.
- **Encoding parameter stop** lewat `stopPrice` (lihat bagian engine di atas) —
  keputusan final, dipakai desk & engine.
- **Time Machine**: range Yahoo `60d`/5m (fallback `1mo`), 2.000 simulasi bootstrap,
  asumsi ditampilkan apa adanya di UI ("simulasi data historis, bukan prediksi").
- **Berita & SEC**: Yahoo RSS + `data.sec.gov` (User-Agent wajib), 8-K penting
  item 1.03/1.05/2.02/2.06/3.01/4.02/5.02, cache 5 menit; fundamental XBRL cache
  6 jam dengan penurunan Q4 (tahunan − YTD 9 bulan) bila tidak bertanda 10-K.
- **Tanggal earnings** tidak tersedia dari sumber gratis, jadi `earningsDate`
  selalu `null` dan UI mengatakannya jujur (tidak dikarang).
- **Belum termasuk**: tracker transaksi kongres (Pelosi) karena butuh parsing PDF
  House Clerk; alert belum berjalan sebagai worker latar belakang (hanya saat
  halaman Alert terbuka).

### Skrip bantu

```bash
node scripts/trading-check.mjs         # 8 halaman + 12 API + screenshot (BASE_URL opsional)
node scripts/trading-interactions.mjs  # alur rencana → order → posisi → alert → pengaturan
node --env-file=.env.local scripts/reset-demo-trading.mjs   # bersihkan data trading demo
node scripts/seed-demo-trading.mjs http://localhost:3101    # isi data demo (rencana, jurnal, alert)
```

---

## Putaran 2 — bahasa sederhana & prioritas informasi (2 November 2026)

Pengguna meminta bahasa lebih mudah dimengerti dan "konfigurasi ulang apa yang
penting/tidak penting". Panduan lengkap ada di [docs/UI-COPY.md](UI-COPY.md).

**Hierarki baru di semua halaman:**

1. **Penting (selalu tampil):** kotak cari saham, harga terakhir + perubahan,
   1 kalimat kesimpulan, tombol Buat rencana, ringkasan rencana aktif (harga
   masuk, batas rugi, target untung, jumlah lembar, jam keluar), order/posisi
   berjalan, pengingat aktif, batas risiko hari ini.
2. **Pendukung (ringkas, bisa dilipat):** berita 3 teratas + "Lihat semua",
   pengaturan inti risiko.
3. **Lanjutan (`<Disclosure>` tertutup default):** detail teknikal (RSI/MA/ATR),
   fundamental SEC, aturan stop/target sendiri, Time Machine, pengaturan
   lanjutan (ukuran posisi maks, nilai order maks, buffer kas, min R:R,
   universe pemindai).

**Glosarium UI:** Harga masuk · Batas rugi (stop) · Target untung · Jumlah
lembar · Kerugian kalau kena batas rugi · Imbalan : risiko (2R = untung 2×
kerugian) · Jam keluar (flat by) · Latihan (uang kertas) · Daftar pantau ·
Pengingat harga · Cari setup · Periksa saham · Rentang awal · Ayunan harga (ATR).

**Perbaikan bug pada putaran ini:**

- `src/lib/money.ts`: `formatMoney` sekarang selalu memakai jumlah desimal mata
  uang — harga USD tampil `$404.20`, bukan `$404.2` (berlaku untuk seluruh
  aplikasi; IDR/JPY tetap tanpa desimal).
- Statistik risiko: "trade hari ini" hanya menghitung order yang benar-benar
  diisi/ditutup (`filled`/`closed`); order yang dibatalkan tidak memakai jatah.
- Jam pasar tidak lagi duplikat ("Pra-pasar · Pra-pasar sampai…" → "Sekarang
  07.09 ET. Bel buka 09.30 ET.").
- Angka dolar besar pakai satuan Indonesia (`fmtUsdCompact`: "$103,6 miliar",
  "$787 juta"), EPS `fmtUsdDollars` ("$0,22") — tidak ada lagi "US$103,6 M"/"jt".
- Grafik 5 menit berlabel "Sesi terakhir (Jum, 30 Okt)" saat pra-pasar, bukan
  "hari ini"; berita default 3 item dengan "Lihat semua (N)".
- Label risiko di mesin rencana memakai bahasa manusia ("Batas rugi",
  "Kerugian per trade", "Jumlah lembar", "Saham ramai", "Imbalan : risiko").
- Semua route/pages yang memanggil data pasar diberi `maxDuration` (Vercel)
  agar pemindaian ±100 saham, Time Machine, inspeksi, dan fundamental tidak
  kena batas waktu fungsi serverless.

**Sapu bug & perbaikan tambahan (putaran 2):**

- `<a><button>` bersarang dihapus dari dashboard, rencana, posisi, dan alert
  (sekarang `<Link className={buttonVariants(...)}>`); target sentuh chip
  dashboard, tombol kembali `PageHeader`, dan tombol hapus pengingat menjadi
  ≥40px.
- Pesan validasi Zod untuk pengaturan risiko dan rencana sekarang berbahasa
  Indonesia (sebelumnya bocor "Too small: expected number to be >=0").
- `GET /api/trading/quote` tanpa simbol mengembalikan `{ quotes: [] }` (tidak
  lagi campur `error` di respons sukses).
- Catatan API scanner dibersihkan dari kata "semesta"/"Mode ORB"/"Watchlist";
  `fmtVolume` memakai "juta/miliar" (bukan "jt").
- `loading.tsx` skeleton untuk seluruh halaman `/trading` (navigasi terasa
  lebih cepat), dan jargon "flat by" di pengaturan/posisi diganti "jam keluar".

**QA putaran 2:**

- `node scripts/trading-interactions.mjs`: **12/12 langkah lulus** (rencana →
  Uji peluang → simpan → order → isi → tutup → jurnal → 3 pengingat →
  pengaturan → dashboard), 0 console/page error.
- `node scripts/trading-check.mjs` di build produksi: 8 halaman + 12 API
  **200**, 0 overflow (390px & 1440px), 0 masalah.
- Vercel produksi: build sukses (69 route); akun uji live → `/trading`,
  `/api/trading/settings`, `/quote`, `/inspect/TSLA`, `/scan` **200**; akun
  uji dihapus kembali. URL: https://catatku-dun.vercel.app

