# Integrasi BCA — Catat Otomatis dari Email

Dokumen ini menjelaskan cara membuat transaksi dari email notifikasi BCA masuk otomatis ke **Kotak Masuk Catatku**, tinggal dikonfirmasi kategori/validitasnya.

## Ringkasan

| Jalur | Status | Catatan |
| --- | --- | --- |
| **API MyBCA / aplikasi MyBCA** | ❌ Tidak tersedia | Tidak ada API publik untuk rekening pribadi; scraping/login otomatis melanggar ketentuan & berisiko. Jangan pernah memberikan PIN/OTP. |
| **Email notifikasi BCA** | ✅ Didukung (best-effort) | Contoh email: *Internet Transaction Journal* dari `bca@bca.co.id` (myBCA/QRIS/kartu). Tidak semua transaksi dikirim via email. |
| **Impor mutasi/e-Statement CSV** | ✅ Didukung | Lebih lengkap untuk rekonsiliasi bulanan; PDF belum didukung (butuh contoh format). |

Alur:

```
Email BCA → diteruskan (Apps Script/forwarding) → POST /api/inbound/email?secret=...
→ parser BCA (nominal, jenis, tanggal, merchant) → pending_transactions
→ Kotak Masuk: konfirmasi kategori → transaksi tercatat
```

## 1. Aktifkan notifikasi email BCA

Pastikan email transaksi dari BCA masuk ke kotak Gmail/email yang biasa kamu pakai. Format email yang sudah diuji:

```
Subject : Internet Transaction Journal
From    : BCA <bca@bca.co.id>

Transaction Date : 19 Oct 2026 19:24:43
Transaction Type : QRIS Payment
Payment to       : AYAM GEPUK SYIFA ALPK3-
Total Payment    : IDR 50,000.00
```

Parser juga mendukung varian berbahasa Indonesia (`Tanggal Transaksi`, `Jenis Transaksi`, `Pembayaran ke`, `Total Pembayaran`) serta email pemasukan (`Transfer Received`, `Payment from`, `Salary`, dst).

## 2. Environment variable (Vercel)

Set di **Vercel → Project → Settings → Environment Variables** (Production + Preview), lalu **Redeploy**:

| Variable | Contoh | Fungsi |
| --- | --- | --- |
| `INBOUND_EMAIL_SECRET` | string acak 32+ karakter | Kunci webhook (wajib, cegah spam) |
| `INBOUND_EMAIL_USER` | `email-akun-catatku@gmail.com` | Email **akun Catatku** yang menerima transaksi |

> Aplikasi ini single-user: satu alamat email BCA per deployment. `INBOUND_EMAIL_USER` harus sama dengan email login Catatku.

Webhook: `https://<domain>/api/inbound/email?secret=<INBOUND_EMAIL_SECRET>`

## 3. Teruskan email BCA

### Opsi A — Google Apps Script (rekomendasi, tanpa domain, gratis)

Berjalan di cloud Google, jadi tetap jalan walau laptop mati.

1. Buka [script.google.com](https://script.google.com) → **New project**.
2. Salin isi file [`scripts/gmail-bca-forwarder.gs`](../scripts/gmail-bca-forwarder.gs).
3. Ganti `WEBHOOK` dengan URL webhook + secret kamu.
4. Jalankan fungsi **`installTrigger`** → izinkan akses Gmail + koneksi eksternal.
5. Jalankan **`forwardBcaEmails`** sekali untuk uji (lihat log eksekusi).
6. Trigger otomatis tiap **10 menit**: email BCA baru akan diteruskan otomatis.

### Opsi B — Forwarding email ke layanan inbound

1. Buat alamat inbound di penyedia seperti **Postmark** (inbound stream), **Mailgun**, atau **Cloudflare Email Routing** (butuh domain).
2. Set webhook penyedia ke URL Catatku di atas (HTTP POST JSON).
3. Di Gmail, buat filter: dari `bca@bca.co.id` → **Forward** ke alamat inbound tersebut.
4. Format payload yang didukung: Postmark (`From/Subject/TextBody/HtmlBody/MessageID`), Mailgun (`from/subject/body-plain`), SendGrid, atau JSON generik `{ from, subject, text, messageId }`.

## 4. Konfirmasi di aplikasi

- Buka **Kotak Masuk** (menu *Lainnya* di HP, sidebar di desktop, atau banner di Beranda).
- Tiap item menampilkan jenis, nominal, tanggal, merchant, dan badge sumber.
- Pilih kategori → **Konfirmasi**; atau **Abaikan**.
- Item dengan parser ragu ditandai **“Perlu dicek”** (`confidence: low`).

## 5. Impor mutasi/e-Statement (CSV)

Di Kotak Masuk bagian bawah, unggah file CSV. Format kolom yang didukung (header fleksibel):

```csv
tanggal,keterangan,nominal
2026-10-19,AYAM GEPUK SYIFA,-50000
2026-10-20,GAJI,8750000
```

Atau dengan kolom debit/kredit:

```csv
Tanggal;Keterangan;Debit;Kredit
19/10/2026;QRIS AYAM GEPUK;50000;
20/10/2026;GAJI;;8750000
```

- Tanggal: `dd/mm/yyyy`, `dd-mm-yyyy`, `yyyy-mm-dd`, `dd Mmm yyyy`.
- Nominal: `Rp50.000`, `50,000.00`, tanda minus = pengeluaran.
- Baris duplikat otomatis dilewati.
- Untuk e-Statement PDF: kirim contohnya agar parser PDF bisa ditambahkan.

## 6. Batasan

- Hanya transaksi yang **dikirim BCA lewat email** yang tertangkap (tarik tunai ATM dan sebagian transaksi kartu tidak dikirim).
- Format email bisa berubah sewaktu-waktu → gunakan konfirmasi; parser mudah diperbarui.
- Email bukan realtime sempurna: delay ±10 menit (interval Apps Script) atau beberapa detik (webhook forwarding langsung).
- Deduplikasi memakai Message-ID Gmail + hash isi, jadi email yang diteruskan berulang tidak menggandakan transaksi.

## 7. Keamanan

- Tidak pernah meminta PIN/OTP/akses login MyBCA.
- Webhook dilindungi secret; tanpa secret → 401.
- Yang disimpan hanya field transaksi (nominal, tanggal, merchant, subjek, pengirim) — bukan seluruh isi email.
- Jika secret bocor: ganti `INBOUND_EMAIL_SECRET`, redeploy, perbarui URL di Apps Script.
