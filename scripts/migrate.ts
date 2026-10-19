import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
fs.mkdirSync(path.dirname(file), { recursive: true });

const sqlite = new Database(file);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

const folder = path.join(process.cwd(), "drizzle");
if (!fs.existsSync(path.join(folder, "meta", "_journal.json"))) {
  console.error("Folder migrasi belum ada. Jalankan `npm run db:generate` dulu.");
  process.exit(1);
}

migrate(db, { migrationsFolder: folder });
sqlite.close();
console.log(`Migrasi selesai: ${file}`);
