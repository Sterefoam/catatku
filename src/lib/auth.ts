import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, ensureDatabaseReady } from "./db";
import { sessions, users, type UserRow } from "./db/schema";
import { seedDefaultCategories } from "./db/seed-defaults";
import { hashPassword, verifyPassword } from "./password";
import type { SessionUser, ThemeMode } from "./types";

export const SESSION_COOKIE = "catatku_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    currency: row.currency,
    theme: (row.theme === "dark" ? "dark" : "light") as ThemeMode,
    createdAt: row.createdAt,
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));
  return rows[0];
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  currency?: string;
}): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();
  if (await findUserByEmail(email)) {
    throw new AuthError("Email ini sudah terdaftar. Coba masuk saja.", 409);
  }

  const now = new Date().toISOString();
  const row: UserRow = {
    id: randomUUID(),
    name: input.name.trim(),
    email,
    passwordHash: hashPassword(input.password),
    currency: input.currency ?? "IDR",
    theme: "light",
    createdAt: now,
  };

  await db.insert(users).values(row);
  await seedDefaultCategories(db, row.id);
  return toSessionUser(row);
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser> {
  const row = await findUserByEmail(email);
  if (!row || !verifyPassword(password, row.passwordHash)) {
    throw new AuthError("Email atau kata sandi salah.", 401);
  }
  return toSessionUser(row);
}

export async function createSession(
  userId: string,
  options: { secure?: boolean } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await ensureDatabaseReady();

  // Bersihkan sesi yang sudah kedaluwarsa.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString()));
  await db.insert(sessions).values({
    id: randomUUID(),
    userId,
    token,
    expiresAt,
  });

  // `Secure` hanya dipasang bila koneksi HTTPS (atau dipaksa lewat COOKIE_SECURE),
  // supaya login tetap berfungsi saat diakses lewat HTTP LAN / tunnel tanpa TLS.
  const secure =
    process.env.COOKIE_SECURE === "1"
      ? true
      : process.env.COOKIE_SECURE === "0"
        ? false
        : (options.secure ?? process.env.NODE_ENV === "production");

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await ensureDatabaseReady();
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  jar.delete(SESSION_COOKIE);
}

/** Sesi aktif (di-cache per request agar tidak query berulang). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await ensureDatabaseReady();
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.token, token),
        gt(sessions.expiresAt, new Date().toISOString()),
      ),
    );

  const row = rows[0];
  return row ? toSessionUser(row.user) : null;
});

/** Untuk halaman: wajib masuk, kalau belum arahkan ke /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export function isUniqueEmailError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed: users\.email/i.test(error.message)
  );
}
