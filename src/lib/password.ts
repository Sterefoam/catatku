import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

/** Hash kata sandi memakai scrypt + salt acak. Format: `salt:hash`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password.normalize("NFKC"), salt, KEY_LENGTH);
  return `${salt}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const derived = scryptSync(password.normalize("NFKC"), salt, KEY_LENGTH);
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}
