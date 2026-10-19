import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

/**
 * Menjalankan migrasi SQL ke database libSQL.
 * - Lokal: `file:data/app.db`
 * - Turso: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 */
async function main() {
  const url =
    process.env.TURSO_DATABASE_URL ??
    process.env.DATABASE_URL ??
    `file:${(process.env.DATABASE_PATH ?? "data/app.db").replace(/\\/g, "/")}`;

  if (url.startsWith("file:")) {
    const filePath = path.resolve(url.slice("file:".length));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const folder = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(path.join(folder, "meta", "_journal.json"))) {
    console.error("Folder migrasi belum ada. Jalankan `npm run db:generate` dulu.");
    process.exit(1);
  }

  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: folder });
  client.close();
  console.log(`Migrasi selesai: ${url}`);
}

main().catch((error) => {
  console.error("Migrasi gagal:", error);
  process.exit(1);
});
