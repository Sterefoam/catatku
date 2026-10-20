import fs from "node:fs";
import { createClient } from "@libsql/client";

/**
 * Menghapus satu akun (mis. akun demo) beserta seluruh datanya dari database.
 * Pemakaian: node scripts/cleanup-user.mjs demo@catatku.id
 */
function readEnv() {
  const text = fs.readFileSync(".env.local", "utf8");
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value) values[match[1]] = value;
  }
  return values;
}

const email = (process.argv[2] ?? "demo@catatku.id").trim().toLowerCase();
const env = readEnv();
const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const users = await client.execute({
  sql: "select id, email from users where email = ?",
  args: [email],
});

for (const row of users.rows) {
  for (const table of [
    "transactions",
    "pending_transactions",
    "budgets",
    "goals",
    "reminders",
    "categories",
    "sessions",
  ]) {
    await client.execute({
      sql: `delete from ${table} where user_id = ?`,
      args: [row.id],
    });
  }
  await client.execute({ sql: "delete from users where id = ?", args: [row.id] });
  console.log("Dihapus:", row.email);
}

const remaining = await client.execute("select email from users");
console.log("User tersisa:", remaining.rows.map((row) => row.email).join(", ") || "(kosong)");
await client.close();
