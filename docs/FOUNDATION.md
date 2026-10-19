# FONDASI PROYEK CATATKU — Baca ini dulu

Aplikasi PWA pencatat keuangan pribadi. Stack: **Next.js 15 App Router + TypeScript + Tailwind CSS v4 + Drizzle ORM + libSQL (file lokal / Turso di cloud)**, mobile-first, tema terang/gelap.

Repo root: `C:\Users\ryana\OneDrive\Documents\deepseek-harness\default-workspace`

## Aturan kerja tim (WAJIB)

1. **Hanya tulis file di scope milikmu.** Jangan mengubah file fondasi bersama, `package.json`, `src/lib/*`, `src/components/ui/*`, `src/components/app/*`, `src/components/transactions/*`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, route API milik orang lain, atau file milik teammate lain.
2. **Jangan menjalankan `npm install`, `npm run build`, atau `npm run dev`.** Lead yang mengurus dependency, migrasi DB, server, dan build. Dependency sedang diinstal; kalau `node_modules` belum lengkap, tetap tulis kode dulu.
3. **Jangan restart/matikan dev server.** Lead menjalankan `next dev` di `http://localhost:3100`. Kalau belum hidup, tulis kode dulu; Lead akan mengabari.
4. Kalau butuh perubahan file fondasi (mis. prop komponen UI), **kirim pesan ke Lead** — jangan edit sendiri.
5. Bahasa UI: **Indonesia** yang ramah dan ringkas. Jangan ada teks placeholder bahasa Inggris.
6. Uang selalu dalam **satuan terkecil (integer minor units)**: Rupiah = rupiah, USD = cent. Tampilkan dengan `formatMoney(amount, currency)`.
7. Tanggal transaksi = string `"YYYY-MM-DD"` (zona Asia/Jakarta). Gunakan helper di `src/lib/date.ts`.
8. Semua halaman mobile-first; harus rapi juga di desktop. Dukung mode gelap (pakai token warna, jangan hardcode warna terang). Elemen interaktif minimal 40px, kontras memadai.
9. Verifikasi hasil dengan `curl` ke halaman/API setelah dev server hidup, dan laporkan hasilnya ke Lead.

## Perintah shell penting

npm di sandbox ini **wajib** memakai cache dalam workspace. Setiap perintah `npm`/`npx`:

```powershell
$env:npm_config_cache="$PWD\.npm-cache"; $env:npm_config_logs_dir="$PWD\.npm-logs"
```

## Struktur folder

```
src/app/
  layout.tsx                 (root, provider tema/sesi)
  globals.css                (design token + utility; JANGAN diubah)
  (auth)/login|register      (Lead)
  (app)/layout.tsx           (requireUser + AppProvider + AppShell)
  (app)/page.tsx             (Beranda — Lead)
  (app)/riwayat/page.tsx     (Riwayat — teammate riwayat)
  (app)/grafik/page.tsx      (Grafik — teammate grafik)
  (app)/kategori/page.tsx    (Kategori — teammate kategori)
  (app)/target/page.tsx      (Target — teammate target)
  (app)/pengingat/page.tsx   (Pengingat — teammate pengingat)
  (app)/pengaturan/page.tsx  (Pengaturan — Lead)
  api/...                    (route handler; lihat tabel di bawah)
src/components/
  ui/                        (komponen dasar bersama; JANGAN diubah)
  app/                       (shell, provider, konteks)
  transactions/              (sheet catat transaksi, baris transaksi)
  history/  charts/  categories/  goals/  reminders/  settings/   <- folder milik teammate
src/lib/                     (data, auth, uang, tanggal, analitik, validasi, API helper)
```

## Data server (aman dipakai di server component / route handler)

Semua pengambilan data memakai sesi pengguna di server. Fungsi di `src/lib/data.ts` (semua **sync**):

```ts
getDashboardData(userId)        // { summary, recent, budgetUsage, goals }
getSummary(userId)              // SummaryDTO
getRecentTransactions(userId, limit=5): TransactionDTO[]
listTransactions(userId, { limit?, offset?, type?, categoryId?, q?, from?, to? }): TransactionDTO[]
listAllTransactions(userId): TransactionDTO[]
getTransactionById(userId, id): TransactionDTO | null
getCategories(userId): CategoryDTO[]              // ada transactionCount
getCategoryById(userId, id): CategoryDTO | null
getGoals(userId): GoalDTO[]
getBudgetUsage(userId, period?): BudgetUsageDTO   // period = "YYYY-MM"
getReminder(userId): ReminderDTO
```

Halaman: selalu mulai dengan `const user = await requireUser();` dari `@/lib/auth`. Jangan query DB langsung untuk data halaman; pakai fungsi di atas. (Kalau perlu query khusus, minta Lead.)

## Endpoint API (sudah tersedia)

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| GET | `/api/transactions` | `limit,offset,type,categoryId,q,from,to` | `{ items: TransactionDTO[] }` |
| POST | `/api/transactions` | `{ type, amount(minor), categoryId, date, note? }` | `{ transaction }` |
| PATCH/DELETE | `/api/transactions/[id]` | field transaksi (partial) | `{ transaction }` / `{ ok:true }` |
| GET | `/api/transactions/summary` | – | `{ summary }` |
| GET | `/api/categories` | – | `{ categories: CategoryDTO[] }` (dengan `transactionCount`) |
| POST | `/api/categories` | `{ name, type, icon, color }` | `{ category }` |
| PATCH/DELETE | `/api/categories/[id]` | `{ name?, icon?, color? }` | `{ category }` / `{ ok:true }`; hapus gagal `409` bila dipakai transaksi |
| GET | `/api/categories/options` | – | `{ icons, colors }` |
| GET | `/api/charts` | `?range=week|month|year` | `ChartsDTO` |
| GET/POST | `/api/goals` | `{ name, targetAmount, savedAmount?, deadline? }` | `{ goals }` / `{ goal }` |
| PATCH/DELETE | `/api/goals/[id]` | partial goal | `{ goal }` / `{ ok:true }` |
| GET | `/api/budgets` | `?period=YYYY-MM` | `{ usage: BudgetUsageDTO }` |
| PUT | `/api/budgets` | `{ limitAmount, period?, categoryId? }` | `{ usage }` |
| DELETE | `/api/budgets` | `?period=YYYY-MM` | `{ usage }` |
| GET/PUT | `/api/reminders` | `{ time:"HH:mm", days:[...], isActive, budgetAlertEnabled }` | `{ reminder }` |
| GET | `/api/export` | `?format=csv|json` | file unduhan |

Error API: `{ error: string, details?: Record<string,string> }` dengan status 400/401/422/404/409.

## Klien: helper & konteks

```tsx
"use client";
import { useApp } from "@/components/app/app-context";
const { user, categories, currency, openCreate, openEdit, refresh, quickAdd } = useApp();
```

- `openEdit(transaction)` → membuka sheet ubah transaksi global (dipakai saat baris transaksi diketuk).
- `openCreate(type?)` → membuka sheet catat transaksi.
- `refresh()` → `router.refresh()`; panggil setelah mutasi supaya data server ter-update.
- `useSessionUser()` dari `@/components/providers` → user atau null.

Fetch API: `@/lib/client-api` → `apiGet, apiPost, apiPatch, apiPut, apiDelete, apiErrorMessage, ApiClientError`.

Notifikasi toast: `import { toast } from "sonner"` → `toast.success("...")`, `toast.error(...)`.

## Komponen UI bersama (JANGAN diubah, pakai saja)

| Import | Komponen / props penting |
| --- | --- |
| `@/components/ui/button` | `Button` variant: `primary, soft, outline, ghost, danger, subtle`; size: `sm, md, lg, icon, iconSm` |
| `@/components/ui/card` | `Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter` |
| `@/components/ui/input` | `Input, Textarea, Label, Field({label,hint,error}), Select` |
| `@/components/ui/dialog` | `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose` (mobile = bottom sheet) |
| `@/components/ui/segmented` | `<Segmented value onChange options={[{value,label,icon?,tone?}]} size? ariaLabel? />` |
| `@/components/ui/switch` | `Switch` (Radix, controlled `checked onCheckedChange`) |
| `@/components/ui/progress` | `<Progress value={0-100} tone="primary|success|danger|warning" />` |
| `@/components/ui/badge` | `<Badge tone="neutral|primary|success|danger|warning|outline">` |
| `@/components/ui/empty-state` | `<EmptyState icon title description action compact? />` |
| `@/components/ui/page-header` | `<PageHeader title subtitle? backHref? eyebrow? action? />` |
| `@/components/ui/amount-input` | input nominal besar (biasanya hanya di sheet transaksi) |
| `@/components/category-icon` | `CategoryIcon({name})`, `CategoryBadge({icon,color,size})` |
| `@/components/brand` | `Logo, BrandLockup` |
| `@/components/theme-toggle` | `ThemeToggle` |
| `@/components/transactions/transaction-list` | `TransactionRow({transaction,showDate?})`, `SectionHeading`, `RecentTransactionList` (butuh `useApp`) |
| `@/components/transactions/quick-add-button` | `QuickAddButton({type,label,variant,size})`, `QuickAddFab` |

Utilitas: `cn()` di `@/lib/utils`, `formatMoney/formatMoneyCompact/formatMoneyInput/currencyMeta` di `@/lib/money`, helper tanggal di `@/lib/date`, analitik murni di `@/lib/analytics` (`buildCharts`, `categoryBreakdown`, `totalsOf`, `filterByRange`, `buildSeries`) — semua pure dan aman dipakai di client.

## Design language

- Aksen utama hijau emerald (`bg-primary`, `bg-primary-soft`), kartu putih `bg-card` dengan `rounded-3xl`, border halus `border-border/80`, bayangan lembut. Latar halaman `bg-background` (ada `app-canvas` di shell).
- Gunakan `text-muted-foreground` untuk teks sekunder, `text-success` pemasukan, `text-danger` pengeluaran, `text-warning` mendekati batas.
- Angka uang: selalu beri kelas `money` (tabular-nums) dan `formatMoney`.
- Animasi halus (`animate-rise`), hindari efek berlebihan. Ikuti pola halaman Beranda: judul 22-25px bold, kartu ringkasan, daftar.
- Mobile: konten max-width, padding `px-4`, jarak antar blok `space-y-5`. Bottom nav sudah disediakan shell (± 76px), jadi jangan menaruh tombol fixed di bawah.
- Jangan memakai library chart eksternal; gambar chart dengan div/SVG.

## Akun untuk uji coba

- Demo: `demo@catatku.id` / `demo12345` (tombol "Coba akun demo" di /login). Data contoh ±2,5 bulan.
- Akun baru: /register (kategori bawaan otomatis dibuat, data kosong untuk menguji empty state).

## Definition of done tiap halaman

- Route bisa dibuka (200) dan tidak ada error runtime/hidrasi.
- Semua state: ada data, kosong, loading/aksi, error.
- Mutasi memakai API + `toast` + `refresh()`; angka ikut berubah tanpa reload.
- Responsif HP & desktop, mode terang & gelap nyaman.
- `npx tsc --noEmit` tidak menambah error baru di file milikmu (jalankan dengan env npm di atas; error milik teammate lain boleh diabaikan).
