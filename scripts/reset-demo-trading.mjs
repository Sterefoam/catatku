/**
 * Bersihkan data Meja Trading milik akun demo (order kertas, rencana, alert).
 * Dipakai untuk menyiapkan ulang data demo/screenshot. Watchlist & pengaturan
 * tidak dihapus.
 *
 * Jalankan: node --env-file=.env.local scripts/reset-demo-trading.mjs
 */

import { createClient } from "@libsql/client";

const url =
  process.env.TURSO_DATABASE_URL ??
  process.env.DATABASE_URL ??
  `file:${(process.env.DATABASE_PATH ?? "data/app.db").replace(/\\/g, "/")}`;
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const found = await client.execute({
  sql: "select id from users where email = ?",
  args: ["demo@catatku.id"],
});
const userId = found.rows[0]?.id;
if (!userId) {
  console.error("Akun demo tidak ditemukan.");
  process.exit(1);
}

for (const table of ["paper_orders", "trade_plans", "price_alerts"]) {
  const result = await client.execute({
    sql: `delete from ${table} where user_id = ?`,
    args: [userId],
  });
  console.log(`${table}: ${result.rowsAffected} baris dihapus`);
}

client.close();
console.log(`Selesai. Data trading demo dibersihkan (user ${userId}).`);
