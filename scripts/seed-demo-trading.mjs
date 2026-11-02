/**
 * Isi data demo Meja Trading: satu rencana aktif, satu trade kertas yang sudah
 * ditutup (jurnal), dan tiga alert (stop, target, flat by). Dipakai untuk
 * screenshot & pengalaman akun demo.
 *
 * Jalankan setelah `node --env-file=.env.local scripts/reset-demo-trading.mjs`:
 *   node scripts/seed-demo-trading.mjs [BASE_URL]
 */

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3101";

function cents(value) {
  return Math.round(value * 100);
}

async function main() {
  const login = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
  if (!login.ok) throw new Error(`Login demo gagal: ${login.status}`);
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  if (!cookie) throw new Error("Cookie sesi tidak diterima.");

  const request = async (path, options = {}) => {
    const response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        cookie,
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }
    if (!response.ok) {
      throw new Error(`${options.method ?? "GET"} ${path} -> ${response.status} ${text.slice(0, 240)}`);
    }
    return payload;
  };

  const quote = await request("/api/trading/quote?symbols=TSLA");
  const price = quote.quotes?.[0]?.price ?? 40000;
  // Harga pemicu sedikit di atas pasar, dibulatkan ke dolar, dalam SEN.
  const entry = Math.round((price * 1.0015) / 100) * 100 + 6;
  const draft = {
    symbol: "TSLA",
    setupType: "orb",
    entryTrigger: entry,
    stopRule: "pct",
    stopPrice: 150,
    targetRule: "2R",
    orMinutes: 15,
  };

  const preview = await request("/api/trading/plans/preview", {
    method: "POST",
    body: JSON.stringify(draft),
  });
  if (!preview.preview?.ok) {
    throw new Error(`Pratinjau tidak lolos: ${JSON.stringify(preview.preview?.errors)}`);
  }

  // Trade kertas yang sudah selesai (masuk jurnal).
  const donePlan = await request("/api/trading/plans", {
    method: "POST",
    body: JSON.stringify({ ...draft, note: "Contoh trade paper selesai: tembus opening range, keluar di target." }),
  });
  const order = await request("/api/trading/orders", {
    method: "POST",
    body: JSON.stringify({ planId: donePlan.plan.id }),
  });
  await request(`/api/trading/orders/${order.order.id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "fill", price: donePlan.plan.entry }),
  });
  await request(`/api/trading/orders/${order.order.id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "close", price: donePlan.plan.target }),
  });

  // Rencana aktif yang menunggu pemicu.
  const activePlan = await request("/api/trading/plans", {
    method: "POST",
    body: JSON.stringify({ ...draft, note: "Rencana demo: tunggu bar 5 menit tutup di atas opening range." }),
  });

  const plan = activePlan.plan;
  const alerts = [
    { symbol: "TSLA", kind: "below", level: plan.stop },
    { symbol: "TSLA", kind: "above", level: plan.target },
    { symbol: "TSLA", kind: "flat-by" },
  ];
  for (const alert of alerts) {
    await request("/api/trading/alerts", { method: "POST", body: JSON.stringify(alert) });
  }

  console.log(
    `Selesai. Harga TSLA ${(price / 100).toFixed(2)}; rencana aktif ${plan.id}; stop ${(plan.stop / 100).toFixed(2)}; target ${(plan.target / 100).toFixed(2)}.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
