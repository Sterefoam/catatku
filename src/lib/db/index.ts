import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type DatabaseClient = BetterSQLite3Database<typeof schema>;

type GlobalWithDb = typeof globalThis & {
  __catatkuDb?: DatabaseClient;
};

const globalWithDb = globalThis as GlobalWithDb;

export function databaseFile(): string {
  return process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
}

function createClient(): DatabaseClient {
  const file = databaseFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const client = drizzle(sqlite, { schema });

  // Auto-migrate on first use so `npm run dev` works without extra steps.
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(path.join(migrationsFolder, "meta", "_journal.json"))) {
    try {
      migrate(client, { migrationsFolder });
    } catch (error) {
      // A concurrent worker may have applied it already — safe to continue.
      console.warn("[catatku] migration skipped:", (error as Error).message);
    }
  }

  return client;
}

/** Singleton DB client — survives HMR in development. */
export const db: DatabaseClient = globalWithDb.__catatkuDb ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalWithDb.__catatkuDb = db;
}

export { schema };
