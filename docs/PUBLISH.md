# 🚀 Panduan Publish — Buka Catatku di iPhone

Aplikasi ini adalah **aplikasi Next.js dengan database libSQL**. Ada dua pilihan:

1. **Di komputer sendiri** — jalankan `npm run build && npm start`, lalu akses lewat LAN atau tunnel (bagian B/C). Aplikasi mati saat komputer dimatikan.
2. **Di cloud (permanen)** — deploy ke **Vercel + Turso** (gratis) agar tetap hidup 24/7 walaupun laptop dimatikan. Ini yang direkomendasikan untuk pemakaian sehari-hari.

Database:
- Lokal: file SQLite `data/app.db` (kompatibel libSQL).
- Produksi: **Turso** (libSQL cloud) — set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`. Tidak ada file yang perlu di-mount.

> ✅ **Deployment aktif:** **https://catatku-dun.vercel.app** (project Vercel `catatku`, database Turso `catatku`). Panduan di bawah tetap berlaku untuk deploy ulang / pindah akun.

---

## ⭐ Rekomendasi: Vercel + Turso (gratis, laptop boleh mati)

Kombinasi gratis: Vercel Hobby (hosting) + Turso free tier (database libSQL). HTTPS otomatis, bisa dipasang sebagai PWA di iPhone, dan **tetap hidup meski laptop mati**.

### 1. Buat database Turso

1. Daftar gratis di **[turso.tech](https://turso.tech)** (bisa login dengan GitHub/Google).
2. **Create Database** → nama `catatku` → pilih region terdekat (mis. Singapore).
3. Catat **Database URL** (bentuknya `libsql://catatku-xxxx.turso.io`).
4. Buka database → **Create Token** (atau menu Tokens) → salin **auth token**.

### 2. Siapkan database (dari komputer)

Buat file `.env.local` di root proyek (tidak ikut ter-commit):

```ini
TURSO_DATABASE_URL="libsql://catatku-xxxx.turso.io"
TURSO_AUTH_TOKEN="token-dari-turso"
```

Lalu jalankan migrasi + (opsional) data demo:

```powershell
npm run db:migrate
npm run db:seed
```

`db:migrate` membuat tabel di Turso. `db:seed` membuat akun demo `demo@catatku.id / demo12345` (boleh dilewati bila tidak perlu).

### 3. Deploy ke Vercel

**Opsi A — lewat GitHub (paling mudah):**

1. Push proyek ini ke repository GitHub.
2. Buka **[vercel.com/new](https://vercel.com/new)** → import repo.
3. Tambahkan Environment Variables (Production + Preview):
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
4. Klik **Deploy** → tunggu selesai.
5. Buka domain `https://<nama-proyek>.vercel.app` di iPhone.

**Opsi B — lewat CLI:**

```powershell
npx vercel            # login & buat project (pertama kali)
npx vercel env add TURSO_DATABASE_URL production
npx vercel env add TURSO_AUTH_TOKEN production
npx vercel --prod
```

### 4. Pasang di iPhone

Safari → buka domain Vercel → **Bagikan → Tambah ke Layar Utama**. Notifikasi browser bisa diaktifkan dari halaman **Pengingat**.

### Catatan Vercel + Turso

- **Tidak perlu** disk/volume; semua data di Turso.
- Migrasi tabel otomatis dicek saat request pertama; kalau ingin mematikan, set `SKIP_DB_MIGRATE=1`.
- Data lama dari laptop bisa dipindahkan: di **Pengaturan → Unduh JSON** (laptop), lalu **Pengaturan → Pulihkan dari cadangan JSON** setelah login di domain Vercel.
- Jangan commit `.env.local` (sudah di-.gitignore).
- Domain kustom bisa ditambahkan gratis di Vercel (mis. `catatku.domainmu.com`).

---

## A. Akses cepat dari HP di Wi-Fi yang sama (tanpa deploy)

Paling simpel, cocok untuk mencoba sekarang.

1. Jalankan server di komputer (sudah otomatis listen di semua interface):

   ```bash
   npm run build
   npm start          # http://localhost:3100
   ```

2. Cari IP LAN komputer:

   ```powershell
   ipconfig | findstr /i "IPv4"
   # contoh: 192.168.1.10
   ```

3. Izinkan port 3100 di Windows Firewall (jalankan **PowerShell sebagai Administrator**, sekali saja):

   ```powershell
   New-NetFirewallRule -DisplayName "Catatku 3100" -Direction Inbound -Protocol TCP -LocalPort 3100 -Action Allow
   ```

4. Di iPhone (Safari) buka: **`http://<IP-LAN>:3100`** — mis. `http://192.168.1.10:3100`.

Catatan:
- HP dan komputer harus di Wi-Fi yang sama; IP bisa berubah saat reconnect.
- Tanpa HTTPS, "Tambahkan ke Layar Utama" tetap bisa, tetapi **service worker/offline dan notifikasi browser butuh HTTPS** (iOS mensyaratkannya). Untuk PWA penuh, pakai jalur B/C/D.

---

## B. Tunnel HTTPS cepat (bisa diakses dari mana saja, tanpa deploy)

Membuka server lokal ke internet lewat URL HTTPS sementara. Cocok untuk mencoba di iPhone pakai data seluler / Wi-Fi lain.

### Opsi B1 — localhost.run (tanpa akun, tanpa install)

```powershell
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL -o ServerAliveInterval=30 -R 80:localhost:3100 nokey@localhost.run
```

Tunggu sampai muncul baris seperti:

```
xxxxxx.lhr.life tunneled with tls termination, https://xxxxxx.lhr.life
```

URL itu bisa langsung dibuka di iPhone. Alias npm:

```bash
npm run tunnel
```

### Opsi B2 — Cloudflare Tunnel (tanpa akun)

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3100
```

Akan muncul URL `https://xxxx.trycloudflare.com`.

Catatan penting:
- **URL berubah setiap tunnel dijalankan ulang**, dan hanya hidup selama komputer + tunnel menyala.
- Komputer ikut menanggung trafik; sebaiknya hentikan tunnel (`Ctrl+C`) bila sudah selesai.
- URL ini **publik** — siapa pun yang tahu tautannya bisa mendaftar akun. Gunakan akun pribadi, dan untuk pemakaian serius pilih jalur D.

### iPhone: pasang sebagai aplikasi (PWA)

1. Buka URL HTTPS di **Safari**.
2. Ketuk tombol **Bagikan** (kotak dengan panah ke atas).
3. Pilih **Tambah ke Layar Utama** → **Tambah**.
4. Buka dari ikon di layar utama (tampil fullscreen tanpa address bar).
5. Untuk notifikasi: buka **Pengaturan → Pengingat**, izinkan notifikasi, lalu uji. Notifikasi browser berjalan selama app/PWA aktif (bukan push latar belakang).

---

## C. Tailscale — privat, tanpa membuka ke publik (rekomendasi untuk data asli)

Komputer ini sudah punya Tailscale. Cara ini membuat aplikasi hanya bisa diakses perangkat di akun Tailscale-mu sendiri.

1. Install **Tailscale** di iPhone (App Store), login dengan akun yang sama seperti di komputer.
2. Cek IP Tailscale komputer:

   ```powershell
   ipconfig | findstr /i "IPv4"   # salah satunya 100.x.y.z (Tailscale)
   ```

3. Buka di iPhone: **`http://100.x.y.z:3100`** (HP harus Tailscale aktif).

Ingin HTTPS (perlu untuk PWA penuh) tanpa domain? Jalankan di komputer (butuh Admin):

```powershell
tailscale serve --bg 3100
tailscale funnel status
```

`tailscale serve` memberi URL `https://<nama-komputer>.<tailnet>.ts.net` yang bisa dibuka dari iPhone di tailnet yang sama. `tailscale funnel` membukanya ke publik (hanya jika memang diinginkan).

---

## D. Deploy permanen (bisa diakses kapan saja, HP tidak satu Wi-Fi)

Butuh hosting yang mendukung **Node.js + disk permanen**. Ini opsi yang direkomendasikan untuk pemakaian harian.

### D1. Railway (paling cepat)

1. Push repo ke GitHub.
2. Di [railway.app](https://railway.app): **New Project → Deploy from GitHub repo**.
3. Set variabel:
   - `DATABASE_PATH=/data/app.db`
   - `NODE_ENV=production`
4. Tambahkan **Volume** dan mount ke `/data`.
5. Build command: `npm run build`; Start command: `npm run start:prod` (sudah tersedia, menghormati `$PORT`).
6. Buka domain `https://<app>.up.railway.app` di iPhone → pasang ke Layar Utama.

### D2. Render

1. **New → Web Service**, hubungkan repo.
2. Build: `npm install && npm run build` · Start: `npm run start:prod`.
3. Tambahkan **Disk** (mis. 1 GB) mount ke `/data`, set `DATABASE_PATH=/data/app.db`.
4. Setelah deploy, buka URL `https://<app>.onrender.com`.

### D3. Fly.io / Docker / VPS

Repo ini menyertakan `Dockerfile` (Node 22, SQLite, volume `/data`):

```bash
docker build -t catatku .
docker run -d --name catatku -p 3000:3000 -v catatku-data:/data catatku
```

Untuk VPS Ubuntu: install Node 22 + PM2 + Caddy/Nginx sebagai reverse proxy HTTPS:

```bash
npm ci && npm run build
pm2 start npm --name catatku -- run start:prod
# Caddy: catatku.contoh.com { reverse_proxy 127.0.0.1:3000 }
```

### D4. Vercel — butuh penyesuaian

Vercel cocok untuk Next.js, **tapi filesystem-nya tidak permanen**, sehingga SQLite (`better-sqlite3`) tidak bisa dipakai untuk data produksi. Butuh migrasi database ke **Turso (libSQL)** atau Postgres sebelum deploy ke Vercel. Gunakan Railway/Render/Fly/VPS bila ingin tetap SQLite.

---

## 🔐 Checklist sebelum dipakai untuk data asli

- [ ] Akses lewat **HTTPS** (tunnel/Tailscale serve/Railway/Render/VPS), bukan HTTP publik.
- [ ] Buat **akun pribadi** (Daftar), jangan memakai akun demo.
- [ ] Isi data asli hanya setelah yakin hosting-nya privat/aman.
- [ ] **Backup** `data/app.db` secara berkala (file SQLite; salin saat server berhenti atau pakai `.backup`). Ekspor CSV/JSON juga tersedia di menu Pengaturan.
- [ ] Jangan commit folder `data/` (sudah masuk `.gitignore`).
- [ ] Bila server publik: matikan/ubah endpoint demo (default `demo@catatku.id` / `demo12345`) — endpoint `/api/auth/demo` saat ini terbuka untuk siapa pun.
- [ ] Set `COOKIE_SECURE=1` bila yakin hanya diakses via HTTPS (memaksa cookie `Secure`).
- [ ] Pantau ukuran disk dan log; SQLite menyimpan data di satu file.

---

## 🧰 Perintah harian

```bash
npm run build && npm start     # produksi lokal (port 3100)
npm run dev                    # mode pengembangan
npm run tunnel                 # URL HTTPS sementara (localhost.run)
npm run db:reset               # reset data demo
```
