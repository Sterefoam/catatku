import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = path.join(process.cwd(), "docs", "screenshots", "trading");
const EDGE =
  process.env.EDGE_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const seen = new Set();

function record(scope, message) {
  const key = `${scope}::${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  problems.push({ page: scope, message });
}

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

page.on("console", (message) => {
  if (message.type() === "error") record("console", message.text());
});
page.on("pageerror", (error) => record("pageerror", error.message));

async function shot(name, options = {}) {
  await page.waitForTimeout(options.wait ?? 500);
  await page.screenshot({
    path: path.join(OUT, name),
    fullPage: options.fullPage ?? true,
  });
}

async function visit(label, url, options = {}) {
  const response = await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(options.wait ?? 900);
  const info = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    title: document.title,
    h1: document.querySelector("h1")?.textContent?.trim() ?? "",
  }));
  const status = response?.status() ?? 0;
  console.log(
    `[page] ${label} -> ${status} title="${info.title}" h1="${info.h1}" ${
      info.scrollWidth > info.innerWidth + 1 ? `OVERFLOW ${info.scrollWidth}>${info.innerWidth}` : "no-overflow"
    }`,
  );
  if (status !== 200) record("page", `${label} status ${status}`);
  if (info.scrollWidth > info.innerWidth + 1) {
    record("layout", `${label} horizontal overflow ${info.scrollWidth} > ${info.innerWidth}`);
  }
  await shot(`${label}.png`);
  return info;
}

async function api(label, pathName, options = {}) {
  const started = Date.now();
  const response = await context.request.fetch(`${BASE}${pathName}`, {
    method: options.method ?? "GET",
    data: options.data,
    headers: options.data ? { "content-type": "application/json" } : undefined,
  });
  const elapsed = Date.now() - started;
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  console.log(`[api] ${label} -> ${response.status()} in ${elapsed}ms`);
  if (!response.ok()) record("api", `${label} status ${response.status()}`);
  return { status: response.status(), payload, elapsed };
}

try {
  // Login demo lewat API (cookie masuk ke context browser).
  await context.request.post(`${BASE}/api/auth/demo`, {
    data: {},
    headers: { "content-type": "application/json" },
  });

  await visit("trading-dashboard", "/trading");
  await visit("trading-inspeksi", "/trading/inspeksi");
  await visit("trading-inspeksi-tsla", "/trading/inspeksi/TSLA");
  await visit("trading-scan", "/trading/scan");
  await visit("trading-rencana", "/trading/rencana?symbol=TSLA");
  await visit("trading-posisi", "/trading/posisi");
  await visit("trading-alert", "/trading/alert");
  await visit("trading-pengaturan", "/trading/pengaturan");

  // Desktop pass.
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  });
  await desktop.request.post(`${BASE}/api/auth/demo`, {
    data: {},
    headers: { "content-type": "application/json" },
  });
  const desktopPage = await desktop.newPage();
  for (const [label, url] of [
    ["trading-dashboard-desktop", "/trading"],
    ["trading-inspeksi-tsla-desktop", "/trading/inspeksi/TSLA"],
  ]) {
    const response = await desktopPage.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
    await desktopPage.waitForTimeout(900);
    const info = await desktopPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      h1: document.querySelector("h1")?.textContent?.trim() ?? "",
    }));
    console.log(
      `[page] ${label} -> ${response?.status() ?? 0} h1="${info.h1}" ${
        info.scrollWidth > info.innerWidth + 1 ? `OVERFLOW ${info.scrollWidth}>${info.innerWidth}` : "no-overflow"
      }`,
    );
    await desktopPage.screenshot({
      path: path.join(OUT, `${label}.png`),
      fullPage: true,
    });
  }
  await desktop.close();

  // API checks.
  await api("settings", "/api/trading/settings");
  await api("quote", "/api/trading/quote?symbols=TSLA,NVDA,AMD");
  await api("search", "/api/trading/search?q=tesla");
  await api("watchlist", "/api/trading/watchlist");
  await api("scan-daily", "/api/trading/scan?mode=daily&universe=mega&limit=10");
  await api("inspect-tsla", "/api/trading/inspect/TSLA");
  await api("news", "/api/trading/news?symbols=TSLA&hours=72");
  await api("fundamentals", "/api/trading/fundamentals/TSLA");
  await api("entry", "/api/trading/entry?symbol=TSLA&setup=orb&minutes=15");
  await api("plan-preview", "/api/trading/plans/preview", {
    method: "POST",
    data: {
      symbol: "TSLA",
      setupType: "orb",
      entryTrigger: 40000,
      stopRule: "pct",
      stopPrice: 100,
      targetRule: "2R",
    },
  });
  await api("timemachine", "/api/trading/timemachine", {
    method: "POST",
    data: { symbol: "TSLA", entry: 40000, stop: 39600, target: 40800 },
  });
  await api("alerts-check", "/api/trading/alerts/check", { method: "POST", data: {} });
} catch (error) {
  record("fatal", error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

console.log(`\n=== ${problems.length} masalah ===`);
for (const problem of problems) {
  console.log(`- [${problem.page}] ${problem.message}`);
}
if (problems.some((problem) => problem.page === "page" || problem.page === "fatal")) {
  process.exitCode = 1;
}
