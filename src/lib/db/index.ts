import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

/**
 * Koneksi database: libSQL.
 * - Lokal / VPS: URL `file:data/app.db` (format SQLite yang sama).
 * - Produksi serverless (Vercel): set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
 */
export type DatabaseClient = LibSQLDatabase<typeof schema>;

type GlobalWithDb = typeof globalThis & {
  __catatkuDb?: DatabaseClient;
  __catatkuReady?: Promise<void>;
};

const globalWithDb = globalThis as GlobalWithDb;

export function databaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const file = process.env.DATABASE_PATH ?? "data/app.db";
  return `file:${file.replace(/\\/g, "/")}`;
}

export function isRemoteDatabase(): boolean {
  return !databaseUrl().startsWith("file:");
}

function createClientInstance(): DatabaseClient {
  const url = databaseUrl();

  if (url.startsWith("file:")) {
    const filePath = path.resolve(url.slice("file:".length));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  return drizzle(client, { schema });
}

/** Singleton DB client — bertahan antar HMR di development. */
export const db: DatabaseClient = globalWithDb.__catatkuDb ?? createClientInstance();

if (process.env.NODE_ENV !== "production") {
  globalWithDb.__catatkuDb = db;
}

async function runMigrations(): Promise<void> {
  if (process.env.SKIP_DB_MIGRATE === "1") return;

  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(path.join(migrationsFolder, "meta", "_journal.json"))) {
    console.warn("[catatku] folder migrasi tidak ditemukan, migrasi dilewati.");
    return;
  }

  // Aman dipanggil berulang: migrasi yang sudah pernah jalan hanya dicek
  // lewat tabel __drizzle_migrations.
  await migrate(db, { migrationsFolder });
}

export function ensureDatabaseReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = runMigrations().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

let readyPromise: Promise<void> | null = globalWithDb.__catatkuReady ?? null;

if (process.env.NODE_ENV !== "production") {
  globalWithDb.__catatkuReady = readyPromise ?? undefined;
}

export { schema };
