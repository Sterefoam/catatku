import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = path.join(process.cwd(), "docs", "screenshots");
const EDGE =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"],
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
const problems = [];
const seen = new Set();

function record(scope, message) {
  const key = `${scope}::${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  problems.push({ page: scope, message });
}

page.on("console", (message) => {
  if (message.type() === "error") record("console", message.text());
});
page.on("pageerror", (error) => record("pageerror", error.message));

async function shot(name, options = {}) {
  await page.waitForTimeout(options.wait ?? 450);
  await page.screenshot({
    path: path.join(OUT, name),
    fullPage: options.fullPage ?? true,
  });
}

async function visit(label, url) {
  const response = await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    title: document.title,
    h1: document.querySelector("h1")?.textContent?.trim() ?? "",
  }));
  const status = response?.status() ?? 0;
  console.log(
    `[page] ${label} -> ${status} title="${overflow.title}" h1="${overflow.h1}" ${overflow.scrollWidth > overflow.innerWidth + 1 ? `OVERFLOW ${overflow.scrollWidth}>${overflow.innerWidth}` : "no-overflow"}`,
  );
  if (status !== 200) record("page", `${label} status ${status}`);
  if (overflow.scrollWidth > overflow.innerWidth + 1) {
    record("layout", `${label} horizontal overflow ${overflow.scrollWidth} > ${overflow.innerWidth}`);
  }
}

try {
  // 1. Login lewat halaman (screenshot) lalu sesi demo lewat API context.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("00-login.png", { fullPage: false });

  const loginResponse = await context.request.post(`${BASE}/api/auth/demo`, {
    data: {},
    headers: { "content-type": "application/json" },
  });
  if (!loginResponse.ok()) {
    throw new Error(`Demo login gagal: ${loginResponse.status()} ${await loginResponse.text()}`);
  }
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await page.waitForTimeout(800);
  const pwa = await page.evaluate(async () => {
    const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null;
    if (!("serviceWorker" in navigator)) return { manifest, sw: "unsupported" };
    const reg = await navigator.serviceWorker.getRegistration();
    return { manifest, sw: reg ? "registered" : "none" };
  });
  console.log(`[pwa] manifest=${pwa.manifest} serviceWorker=${pwa.sw}`);
  if (pwa.sw !== "registered" && pwa.sw !== "unsupported") record("pwa", "service worker tidak terdaftar");

  // 2. Beranda + sheet catat transaksi
  await visit("beranda", "/");
  await shot("01-beranda.png");

  await page.getByRole("button", { name: /Catat transaksi baru/i }).click();
  await page.waitForTimeout(500);
  await shot("02-sheet-catat.png", { fullPage: false });

  // validasi nominal kosong
  await page.getByRole("button", { name: /Simpan pengeluaran/i }).click();
  await page.waitForTimeout(400);
  await shot("03-sheet-validasi.png", { fullPage: false });

  // isi nominal + kategori (tanpa menyimpan, agar data demo tetap bersih)
  const amountInput = page.locator("#amount");
  await amountInput.fill("15000");
  await page.waitForTimeout(200);
  const categoryButton = page.locator('button[aria-pressed]').nth(2);
  await categoryButton.click();
  await page.waitForTimeout(250);
  await shot("04-sheet-terisi.png", { fullPage: false });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.waitForTimeout(400);

  // 3. Riwayat + pencarian
  await visit("riwayat", "/riwayat");
  await shot("06-riwayat.png");
  const search = page.getByPlaceholder(/Cari catatan atau kategori/i).first();
  if (await search.count()) {
    await search.fill("makan");
    await page.waitForTimeout(700);
    await shot("07-riwayat-cari.png");
    await search.fill("");
  }

  // 4. Grafik + rentang waktu
  await visit("grafik", "/grafik");
  await shot("08-grafik-bulan.png");
  const yearTab = page.getByRole("tab", { name: /Tahun ini/i }).first();
  if (await yearTab.count()) {
    await yearTab.click();
    await page.waitForTimeout(800);
    await shot("09-grafik-tahun.png");
  }

  // 5. Kategori + dialog tambah
  await visit("kategori", "/kategori");
  await shot("10-kategori.png");
  const addCategory = page.getByRole("button", { name: /^Tambah/ }).first();
  if (await addCategory.count()) {
    await addCategory.click();
    await page.waitForTimeout(600);
    await shot("11-kategori-dialog.png", { fullPage: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // 5b. Riwayat sheet filter mobile
  await page.goto(`${BASE}/riwayat`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const filterButton = page.getByRole("button", { name: /Buka saringan transaksi/i }).first();
  if (await filterButton.count()) {
    await filterButton.click();
    await page.waitForTimeout(600);
    await shot("06b-riwayat-filter.png", { fullPage: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // 6. Target & progres
  await visit("target", "/target");
  await shot("12-target.png");

  // 7. Pengingat
  await visit("pengingat", "/pengingat");
  await shot("13-pengingat.png");

  // 8. Pengaturan
  await visit("pengaturan", "/pengaturan");
  await shot("14-pengaturan.png");

  // 9. Halaman catat
  await visit("catat", "/catat");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 10. Dark mode
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await shot("15-beranda-dark.png");
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // 11. Desktop
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await shot("16-beranda-desktop.png");
  await page.goto(`${BASE}/grafik`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await shot("17-grafik-desktop.png");

  console.log(`\n=== PROBLEMS (${problems.length}) ===`);
  for (const problem of problems) console.log(`- [${problem.page}] ${problem.message}`);
  if (problems.length === 0) console.log("Tidak ada error console/hidrasi/overflow.");
} catch (error) {
  console.error("VISUAL CHECK FAILED:", error);
  await page.screenshot({ path: path.join(OUT, "99-failure.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
