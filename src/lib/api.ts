import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getSessionUser } from "./auth";
import type { SessionUser } from "./types";

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonError(
  message: string,
  status = 400,
  details?: Record<string, string>,
): NextResponse {
  return NextResponse.json({ error: message, details }, { status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function validationError(error: ZodError): NextResponse {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!details[key]) details[key] = issue.message;
  }
  const first = error.issues[0]?.message ?? "Periksa kembali data yang diisi.";
  return jsonError(first, 422, details);
}

/** Helper untuk route handler: sesi wajib ada. */
export async function requireApiUser(): Promise<
  { user: SessionUser; response?: never } | { user?: never; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return { response: jsonError("Silakan masuk terlebih dahulu.", 401) };
  }
  return { user };
}

export function numberParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Deteksi apakah request datang lewat HTTPS (mis. di belakang reverse proxy
 * atau tunnel) agar cookie sesi bisa diberi flag `Secure` dengan tepat.
 */
export function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim().toLowerCase() === "https";
  }
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}
