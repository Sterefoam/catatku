import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = "http://localhost:3100";
const OUT = path.join(process.cwd(), "docs", "screenshots");
const EDGE =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "id-ID",
  timezoneId: "Asia/Jakarta",
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

const consoleErrors = [];
let currentStep = "init";
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push({ step: currentStep, text: message.text() });
  }
});
page.on("pageerror", (error) => {
  consoleErrors.push({ step: currentStep, text: `PAGEERROR: ${error.message}` });
});

const results = [];
const failures = [];

async function step(name, fn) {
  currentStep = name;
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`✅ ${name} (${Date.now() - started}ms)`);
  } catch (error) {
    failures.push({ name, error: String(error).split("\n")[0] });
    results.push({ name, ok: false, ms: Date.now() - started });
    console.log(`❌ ${name}: ${String(error).split("\n")[0]}`);
    await page
      .screenshot({ path: path.join(OUT, `qa-fail-${name.replace(/[^a-z0-9]+/gi, "-")}.png`), fullPage: true })
      .catch(() => {});
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const login = await context.request.post(`${BASE}/api/auth/demo`, {
  data: {},
  headers: { "content-type": "application/json" },
});
if (!login.ok()) throw new Error("Demo login gagal");

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

const RUN = Date.now().toString().slice(-6);
const QA_NOTE = "QA cepat " + RUN;
const QA_CATEGORY = "QA Kategori " + RUN;
const QA_GOAL = "QA Target " + RUN;

let balanceBefore = 0;
let balanceAfter = 0;

await step("beranda menampilkan sisa uang", async () => {
  const balanceText = await page.locator("section.hero-card p.money").first().innerText();
  assert(/Rp[\d.]+/.test(balanceText), `format sisa uang tidak valid: ${balanceText}`);
  balanceBefore = Number(balanceText.replace(/[^\d]/g, ""));
  assert(await page.getByRole("button", { name: /Catat pengeluaran/i }).first().isVisible(), "CTA catat pengeluaran tidak ada");
  assert(await page.getByRole("button", { name: /Catat transaksi baru/i }).isVisible(), "FAB tidak ada");
});

await step("catat pengeluaran lewat sheet + validasi kosong", async () => {
  await page.getByRole("button", { name: /Catat transaksi baru/i }).click();
  await page.getByRole("dialog").waitFor();
  // validasi nominal kosong
  await page.getByRole("button", { name: /^Simpan pengeluaran$/ }).click();
  await page.waitForTimeout(250);
  assert(
    (await page.getByText(/Nominal belum diisi/i).count()) > 0,
    "pesan validasi nominal tidak muncul",
  );
  // isi nominal, kategori default, catatan
  await page.locator("#amount").fill("5000");
  await page.locator("#transaction-note").fill(QA_NOTE);
  await page.getByRole("button", { name: /^Simpan pengeluaran$/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15000 });
  await page.getByRole("button", { name: /Makan Rp5\.000/ }).first().waitFor({ timeout: 15000 });
  assert(
    (await page.getByRole("button", { name: /Makan Rp5\.000/ }).count()) > 0,
    "transaksi baru tidak muncul di transaksi terakhir",
  );
  balanceAfter = Number(
    (await page.locator("section.hero-card p.money").first().innerText()).replace(/[^\d]/g, ""),
  );
  assert(balanceAfter === balanceBefore - 5000, `sisa uang tidak berkurang: ${balanceBefore} -> ${balanceAfter}`);
});

await step("riwayat: cari, ubah nominal, hapus", async () => {
  await page.goto(`${BASE}/riwayat`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const search = page.getByLabel("Cari transaksi berdasarkan catatan atau nama kategori");
  await search.fill(QA_NOTE);
  await page.waitForTimeout(500);
  const row = page.getByRole("button", { name: /Pengeluaran Makan Rp5\.000/ }).first();
  assert(await row.isVisible(), "hasil pencarian QA cepat tidak ditemukan");
  await row.click();
  await page.getByRole("dialog").waitFor();
  assert(
    (await page.getByText("Ubah transaksi").count()) > 0,
    "sheet ubah transaksi tidak terbuka",
  );
  await page.locator("#amount").fill("7000");
  await page.getByRole("button", { name: /Simpan perubahan/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForTimeout(2200);
  assert(
    (await page.getByRole("button", { name: /Pengeluaran Makan Rp7\.000/ }).count()) > 0,
    "perubahan nominal tidak tercermin di daftar",
  );
  await page.getByRole("button", { name: /Pengeluaran Makan Rp7\.000/ }).first().click();
  await page.getByRole("button", { name: /Hapus transaksi/ }).click();
  await page.getByRole("button", { name: /^Ya, hapus$/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForTimeout(1800);
  assert(
    (await page.getByRole("button", { name: /Pengeluaran Makan Rp7\.000/ }).count()) === 0,
    "transaksi yang dihapus masih muncul",
  );
  await search.fill("");
});

await step("kategori: tambah, ubah, hapus", async () => {
  await page.goto(`${BASE}/kategori`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /^Tambah/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.locator("#category-name").fill(QA_CATEGORY);
  await dialog.getByLabel("Kopi").click();
  await dialog.getByLabel(/Pilih warna #6366F1/).click();
  await dialog.getByRole("button", { name: /^Tambah kategori$/ }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForTimeout(1800);
  assert((await page.getByText(QA_CATEGORY).count()) > 0, "kategori baru tidak muncul");
  await page.getByLabel(`Ubah kategori ${QA_CATEGORY}`).click();
  await dialog.waitFor();
  await dialog.getByRole("button", { name: /Hapus kategori/ }).click();
  await dialog.getByRole("button", { name: /^Ya, hapus$/ }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForTimeout(1800);
  assert((await page.getByText(QA_CATEGORY).count()) === 0, "kategori yang dihapus masih ada");
});

await step("target: buat target, tambah tabungan, hapus", async () => {
  await page.goto(`${BASE}/target`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const goalsSection = page.locator('section[aria-labelledby="target-heading"]');
  await goalsSection.getByRole("button", { name: /^Tambah$/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.locator("#goal-name").fill(QA_GOAL);
  await dialog.locator("#goal-target-amount").fill("1000000");
  await dialog.getByRole("button", { name: /^Buat target$/ }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForTimeout(1800);
  assert((await page.getByText(QA_GOAL).count()) > 0, "target baru tidak muncul");
  await page.getByRole("button", { name: /Tambah tabungan/ }).first().click();
  await dialog.waitFor();
  await dialog.getByRole("button", { name: /25%/ }).click();
  await dialog.getByRole("button", { name: /Simpan tabungan/ }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForTimeout(2000);
  assert(
    (await page.getByText("25%").count()) > 0,
    "progres target tidak berubah menjadi 25%",
  );
  await page.getByLabel(`Hapus target ${QA_GOAL}`).click();
  await dialog.getByRole("button", { name: /^Ya, hapus$/ }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForTimeout(1800);
  assert((await page.getByLabel(`Hapus target ${QA_GOAL}`).count()) === 0, "target yang dihapus masih ada");
});

await step("pengingat: toggle aktif/nonaktif", async () => {
  await page.goto(`${BASE}/pengingat`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const toggle = page.getByRole("switch", { name: /Aktifkan pengingat catat harian/ });
  const before = await toggle.getAttribute("data-state");
  await toggle.click();
  await page.waitForTimeout(1500);
  const after = await toggle.getAttribute("data-state");
  assert(before !== after, "status switch pengingat tidak berubah");
  await toggle.click();
  await page.waitForTimeout(1500);
  const restored = await toggle.getAttribute("data-state");
  assert(restored === before, "switch pengingat tidak kembali ke status awal");
  assert(
    (await page.getByText(/Waktunya mencatat pengeluaran hari ini/).count()) > 0,
    "pratinjau notifikasi tidak tampil",
  );
});

await step("pengaturan: ganti mata uang USD lalu kembali IDR", async () => {
  await page.goto(`${BASE}/pengaturan`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.locator("#profile-currency").selectOption("USD");
  await page.getByRole("button", { name: /Simpan profil/ }).click();
  await page.waitForTimeout(2200);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const heroText = await page.locator("section.hero-card p.money").first().innerText();
  assert(heroText.includes("$"), `format mata uang belum berubah ke USD: ${heroText}`);
  await page.goto(`${BASE}/pengaturan`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.locator("#profile-currency").selectOption("IDR");
  await page.getByRole("button", { name: /Simpan profil/ }).click();
  await page.waitForTimeout(1800);
});

await step("ganti tema gelap lalu terang", async () => {
  await page.goto(`${BASE}/pengaturan`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.getByRole("tab", { name: /Gelap/ }).click();
  await page.waitForTimeout(700);
  assert(
    await page.evaluate(() => document.documentElement.classList.contains("dark")),
    "kelas dark tidak aktif setelah memilih mode gelap",
  );
  await page.getByRole("tab", { name: /Terang/ }).click();
  await page.waitForTimeout(700);
  assert(
    !(await page.evaluate(() => document.documentElement.classList.contains("dark"))),
    "kelas dark masih aktif setelah memilih mode terang",
  );
});

await step("ekspor CSV & JSON", async () => {
  const csv = await context.request.get(`${BASE}/api/export?format=csv`);
  assert(csv.ok(), `export CSV gagal: ${csv.status()}`);
  const csvText = await csv.text();
  assert(csvText.includes("tanggal") && /makan/i.test(csvText), "isi CSV tidak sesuai");
  const json = await context.request.get(`${BASE}/api/export?format=json`);
  const jsonBody = await json.json();
  assert(Array.isArray(jsonBody.transactions) && jsonBody.transactions.length > 0, "JSON export kosong");
});

await step("halaman terproteksi tanpa sesi diarahkan ke /login", async () => {
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const anonPage = await anon.newPage();
  await anonPage.goto(`${BASE}/target`, { waitUntil: "networkidle" });
  assert(anonPage.url().includes("/login"), `tidak diarahkan ke login: ${anonPage.url()}`);
  await anon.close();
});

await step("logout kembali ke halaman masuk", async () => {
  await page.goto(`${BASE}/pengaturan`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Keluar dari akun ini/ }).click();
  await page.waitForURL(/\/login/, { timeout: 15000 });
  assert(page.url().includes("/login"), "logout tidak mengarah ke /login");
});

await step("manifest, ikon, dan service worker tersedia", async () => {
  for (const asset of ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/sw.js"]) {
    const response = await context.request.get(`${BASE}${asset}`);
    assert(response.ok(), `${asset} -> ${response.status()}`);
  }
  const manifest = await (await context.request.get(`${BASE}/manifest.webmanifest`)).json();
  assert(manifest.short_name === "Catatku", "manifest short_name salah");
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "ikon manifest kurang");
});

await page.screenshot({ path: path.join(OUT, "qa-final.png"), fullPage: false }).catch(() => {});

const summary = {
  passed: results.filter((item) => item.ok).length,
  failed: results.filter((item) => !item.ok).length,
  failures,
  consoleErrors,
};
fs.writeFileSync(path.join(OUT, "qa-report.json"), JSON.stringify(summary, null, 2));

console.log(`\n=== HASIL: ${summary.passed} lulus, ${summary.failed} gagal ===`);
if (failures.length) console.log(JSON.stringify(failures, null, 2));
console.log(`\n=== CONSOLE ERRORS: ${consoleErrors.length} ===`);
for (const error of consoleErrors) console.log(`- [${error.step}] ${error.text}`);

await browser.close();
process.exitCode = failures.length || consoleErrors.length ? 1 : 0;
