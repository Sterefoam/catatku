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

let currentLabel = "start";
const errors = [];
page.on("console", (message) => {
  if (message.type() !== "error") return;
  errors.push({
    label: currentLabel,
    text: message.text(),
    location: message.location(),
  });
});
page.on("pageerror", (error) => {
  errors.push({ label: currentLabel, text: `PAGEERROR: ${error.message}`, location: error.stack?.split("\n")[1] ?? "" });
});

await context.request.post(`${BASE}/api/auth/demo`, { data: {}, headers: { "content-type": "application/json" } });

for (const route of ["/", "/riwayat", "/grafik", "/kategori", "/target", "/pengingat", "/pengaturan", "/catat"]) {
  currentLabel = route;
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const metrics = await page.evaluate(() => {
    const vw = window.innerWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 2 || rect.width > vw + 2) {
        offenders.push({
          tag: el.tagName,
          cls: String(el.className ?? "").slice(0, 110),
          x: Math.round(rect.x),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    }
    return {
      innerWidth: vw,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders: offenders.slice(0, 10),
    };
  });
  console.log(`\n[${route}] vw=${metrics.innerWidth} doc=${metrics.docScrollWidth} body=${metrics.bodyScrollWidth}`);
  for (const offender of metrics.offenders) {
    console.log(`  offender ${offender.tag} w=${offender.width} right=${offender.right} class="${offender.cls}"`);
  }
}

console.log("\n=== CONSOLE/PAGE ERRORS ===");
if (errors.length === 0) console.log("none");
for (const error of errors) {
  console.log(`- [${error.label}] ${error.text} @ ${JSON.stringify(error.location)}`);
}

fs.writeFileSync(
  path.join(OUT, "qa-errors.json"),
  JSON.stringify({ errors, generatedAt: new Date().toISOString() }, null, 2),
);

await browser.close();
