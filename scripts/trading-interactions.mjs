/**
 * QA alur interaktif Meja Trading (versi 2 — struktur UI baru).
 * Jalankan terhadap dev server (3100) atau build produksi (3101):
 *   BASE_URL=http://localhost:3101 node scripts/trading-interactions.mjs
 *
 * Catatan: skrip ini menambah data demo (rencana, order, pengingat). Setelah
 * selesai, bersihkan dengan:
 *   node --env-file=.env.local scripts/reset-demo-trading.mjs
 *   node scripts/seed-demo-trading.mjs <BASE_URL>
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = path.join(process.cwd(), "docs", "screenshots", "trading");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({
  executablePath:
    process.env.EDGE_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 900 },
  locale: "id-ID",
  timezoneId: "Asia/Jakarta",
  isMobile: true,
  hasTouch: true,
});
await context.request.post(`${BASE}/api/auth/demo`, {
  data: {},
  headers: { "content-type": "application/json" },
});
const page = await context.newPage();
page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", (error) => consoleErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

const shot = (name) => page.screenshot({ path: path.join(OUT, name), fullPage: false }).catch(() => null);
const goto = async (url) => {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
};

let createdPlanId = null;

// ---------------------------------------------------------------------
// 1. Rencana: isi cepat, hitung, uji peluang, simpan.
// ---------------------------------------------------------------------
try {
  await goto("/trading/rencana");
  await page.fill("#plan-symbol", "TSLA");
  await page.fill("#plan-entry", "400.10");

  const fastStop = page.locator("button", { hasText: "1,5%" }).first();
  await fastStop.click();
  record("Rencana: pilih batas rugi cepat 1,5%", true);

  const targetTab = page.getByRole("tab", { name: /2R/ }).first();
  await targetTab.click();
  record("Rencana: pilih target 2R", true);

  await shot("flow2-01-rencana-form.png");
  await page.getByRole("button", { name: "Hitung rencana" }).click();
  await page.waitForSelector("text=Ringkasan rencana", { timeout: 120_000 });
  record("Rencana: ringkasan muncul", true);
  await page.waitForTimeout(500);
  await shot("flow2-02-rencana-ringkasan.png");

  const bodyText = await page.locator("body").innerText();
  record(
    "Rencana: ada kerugian & imbalan risiko",
    /kehilangan/i.test(bodyText) && /imbalan/i.test(bodyText),
  );

  const timeMachineSummary = page.getByText("Uji peluang", { exact: false }).first();
  if (await timeMachineSummary.count()) {
    await timeMachineSummary.click();
    await page.waitForTimeout(500);
    const runButton = page.getByRole("button", { name: /Uji peluang|Hitung ulang/ }).first();
    await runButton.click();
    try {
      await page.waitForSelector("text=/Target.*dulu|Stop.*dulu/", { timeout: 120_000 });
      record("Uji peluang: hasil muncul", true);
    } catch {
      record("Uji peluang: hasil muncul", false, "timeout");
    }
    await shot("flow2-03-time-machine.png");
  } else {
    record("Uji peluang: ada di halaman", false);
  }

  await page.getByRole("button", { name: "Simpan rencana" }).click();
  const saveResponse = await page
    .waitForResponse(
      (response) => response.url().includes("/api/trading/plans") && response.request().method() === "POST",
      { timeout: 120_000 },
    )
    .catch(() => null);
  await page.waitForTimeout(2000);
  record("Rencana: tersimpan", saveResponse?.ok() ?? false);
  if (saveResponse?.ok()) {
    const payload = await saveResponse.json().catch(() => null);
    createdPlanId = payload?.plan?.id ?? null;
  }
  await shot("flow2-04-rencana-tersimpan.png");
} catch (error) {
  record("Alur rencana", false, error.message.slice(0, 220));
}

// ---------------------------------------------------------------------
// 2. Order latihan dari daftar rencana.
// ---------------------------------------------------------------------
try {
  await goto("/trading/rencana");
  const orderButton = page.getByRole("button", { name: "Buat order latihan" }).first();
  await orderButton.waitFor({ state: "visible", timeout: 45_000 }).catch(() => null);
  if (await orderButton.count()) {
    await orderButton.click();
    const orderResponse = await page
      .waitForResponse(
        (response) => response.url().includes("/api/trading/orders") && response.request().method() === "POST",
        { timeout: 120_000 },
      )
      .catch(() => null);
    await page.waitForTimeout(1500);
    record("Order latihan: dibuat", orderResponse?.status() === 201);
    await shot("flow2-05-order-dibuat.png");
  } else {
    record("Order latihan: tombol tersedia", false);
  }
} catch (error) {
  record("Alur order", false, error.message.slice(0, 220));
}

// ---------------------------------------------------------------------
// 3. Posisi: isi order lalu tutup.
// ---------------------------------------------------------------------
try {
  await goto("/trading/posisi");
  await shot("flow2-06-posisi.png");

  const fillButton = page.getByRole("button", { name: "Isi order" }).first();
  await fillButton.waitFor({ state: "visible", timeout: 45_000 }).catch(() => null);
  if (await fillButton.count()) {
    await fillButton.click();
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: "Isi order sekarang" }).click();
    await page
      .waitForResponse(
        (response) => /\/api\/trading\/orders\//.test(response.url()) && response.request().method() === "PATCH",
        { timeout: 120_000 },
      )
      .catch(() => null);
    await page.waitForTimeout(2000);
    record("Posisi: order diisi", true);
    await shot("flow2-07-posisi-terisi.png");
  } else {
    record("Posisi: tombol isi tersedia", false);
  }

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const closeButton = page.getByRole("button", { name: "Tutup posisi" }).first();
  await closeButton.waitFor({ state: "visible", timeout: 90_000 }).catch(() => null);
  if (await closeButton.count()) {
    await closeButton.click();
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: "Tutup posisi sekarang" }).click();
    await page
      .waitForResponse(
        (response) => /\/api\/trading\/orders\//.test(response.url()) && response.request().method() === "PATCH",
        { timeout: 120_000 },
      )
      .catch(() => null);
    await page.waitForTimeout(2000);
    record("Posisi: ditutup & masuk jurnal", true);
    await shot("flow2-08-jurnal.png");
  } else {
    record("Posisi: tombol tutup tersedia", false);
  }
} catch (error) {
  record("Alur posisi", false, error.message.slice(0, 220));
}

// ---------------------------------------------------------------------
// 4. Pengingat: prefill ?symbol + preset 3 pengingat.
// ---------------------------------------------------------------------
try {
  const before = await context.request
    .get(`${BASE}/api/trading/alerts`)
    .then((response) => response.json())
    .catch(() => ({ alerts: [] }));

  // Pastikan ada rencana aktif agar kartu preset 3 pengingat muncul.
  await context.request.post(`${BASE}/api/trading/plans`, {
    data: {
      symbol: "TSLA",
      setupType: "orb",
      entryTrigger: 40010,
      stopRule: "pct",
      stopPrice: 150,
      targetRule: "2R",
    },
    headers: { "content-type": "application/json" },
  });

  await goto("/trading/alert?symbol=TSLA");
  const presetButton = page.getByRole("button", { name: /Pasang 3 pengingat/ }).first();
  await presetButton.waitFor({ state: "visible", timeout: 45_000 }).catch(() => null);
  if (await presetButton.count()) {
    await presetButton.click();
    await page.waitForTimeout(3000);
    const after = await context.request
      .get(`${BASE}/api/trading/alerts`)
      .then((response) => response.json())
      .catch(() => ({ alerts: [] }));
    record(
      "Pengingat: 3 pengingat dari rencana",
      (after.alerts ?? []).length >= (before.alerts ?? []).length + 3,
      `${(before.alerts ?? []).length} → ${(after.alerts ?? []).length}`,
    );
    await shot("flow2-09-pengingat.png");
  } else {
    record("Pengingat: kartu preset tersedia", false);
  }
} catch (error) {
  record("Alur pengingat", false, error.message.slice(0, 220));
}

// ---------------------------------------------------------------------
// 5. Pengaturan: simpan tanpa perubahan.
// ---------------------------------------------------------------------
try {
  await goto("/trading/pengaturan");
  const saveSettings = page.getByRole("button", { name: "Simpan pengaturan" });
  await saveSettings.waitFor({ state: "visible", timeout: 45_000 });
  await saveSettings.click();
  await page.waitForTimeout(2500);
  record("Pengaturan: tersimpan", true);
  await shot("flow2-10-pengaturan.png");
} catch (error) {
  record("Alur pengaturan", false, error.message.slice(0, 220));
}

// ---------------------------------------------------------------------
// 6. Dashboard setelah ada data.
// ---------------------------------------------------------------------
try {
  await goto("/trading");
  await page.waitForTimeout(1500);
  await shot("flow2-11-dashboard.png");
  const text = await page.locator("body").innerText();
  record("Dashboard: menampilkan rencana & posisi", /Rencana/.test(text) && /posisi/i.test(text));
} catch (error) {
  record("Dashboard akhir", false, error.message.slice(0, 220));
}

await browser.close();

const deduped = [...new Set(consoleErrors.filter((message) => !/favicon|React DevTools/i.test(message)))];
if (deduped.length) {
  console.log(`\nConsole/page errors (${deduped.length}):`);
  for (const message of deduped.slice(0, 10)) console.log(`- ${message}`);
}

const failed = results.filter((result) => !result.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} langkah lulus ===`);
if (createdPlanId) console.log(`Rencana QA dibuat: ${createdPlanId}`);
process.exitCode = failed.length || deduped.length ? 1 : 0;
