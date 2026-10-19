import fs from "node:fs";
import { createClient } from "@libsql/client";

/** Hapus akun uji tertentu dari database Turso (manual/QA). */
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

const env = readEnv();
const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const pattern = process.argv[2] ?? "qa-vercel-%";
const users = await client.execute({
  sql: "select id, email from users where email like ?",
  args: [`${pattern}%`],
});

for (const row of users.rows) {
  const userId = row.id;
  for (const table of [
    "transactions",
    "budgets",
    "goals",
    "reminders",
    "categories",
    "sessions",
  ]) {
    await client.execute({
      sql: `delete from ${table} where user_id = ?`,
      args: [userId],
    });
  }
  await client.execute({ sql: "delete from users where id = ?", args: [userId] });
  console.log("Dihapus:", row.email);
}

const remaining = await client.execute("select email from users");
console.log("User tersisa:", remaining.rows.map((row) => row.email).join(", ") || "(kosong)");
await client.close();
