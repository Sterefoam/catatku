import { jsonError, jsonOk, readJson, validationError } from "@/lib/api";
import { findUserByEmail } from "@/lib/auth";
import { normalizeEmailPayload, parseBcaEmail } from "@/lib/bca-email-parser";
import { createPendingTransaction } from "@/lib/inbox";
import { z } from "zod";

/**
 * Webhook email masuk (Postmark / Mailgun / SendGrid / Apps Script / generic JSON).
 *
 * Keamanan:
 * - Wajib menyertakan `?secret=...` atau header `x-catatku-secret` yang sama
 *   dengan env INBOUND_EMAIL_SECRET.
 * - Penerima email dicocokkan dengan email akun Catatku yang terdaftar.
 *   Email BCA yang diteruskan harus berisi alamat email yang dipakai login.
 */

const payloadSchema = z.record(z.string(), z.unknown());

function extractEmails(value: string | undefined): string[] {
  if (!value) return [];
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  if (!matches) return [];
  return [...new Set(matches.map((match) => match.toLowerCase()))];
}

export async function POST(request: Request) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) {
    return jsonError(
      "Integrasi email belum dikonfigurasi. Set INBOUND_EMAIL_SECRET di environment.",
      503,
    );
  }

  const url = new URL(request.url);
  const provided =
    url.searchParams.get("secret") ??
    request.headers.get("x-catatku-secret") ??
    "";
  if (provided !== secret) {
    return jsonError("Secret webhook tidak valid.", 401);
  }

  const raw = await readJson(request);
  const parsedPayload = payloadSchema.safeParse(raw);
  if (!parsedPayload.success) return validationError(parsedPayload.error);

  const email = normalizeEmailPayload(parsedPayload.data);
  if (!email) {
    return jsonOk({ ok: true, parsed: 0, created: 0, reason: "payload email tidak dikenali" });
  }

  // Cocokkan alamat penerima email dengan email akun yang terdaftar.
  const recipients = extractEmails(email.to);
  let user = null;
  for (const recipient of recipients) {
    const found = await findUserByEmail(recipient);
    if (found) {
      user = found;
      break;
    }
  }

  if (!user) {
    return jsonOk({
      ok: true,
      parsed: 0,
      created: 0,
      reason: "email penerima tidak cocok dengan akun mana pun",
      recipients,
    });
  }

  const parsed = parseBcaEmail(email);
  let created = 0;
  let duplicates = 0;

  for (const item of parsed) {
    const result = await createPendingTransaction(user.id, {
      source: "email",
      type: item.type,
      amount: item.amount,
      date: item.date,
      note: item.note,
      rawSubject: item.rawSubject,
      rawFrom: item.rawFrom,
      confidence: item.confidence,
      externalId: item.externalId,
    });
    if (result.created) created += 1;
    else duplicates += 1;
  }

  return jsonOk({
    ok: true,
    parsed: parsed.length,
    created,
    duplicates,
    needsReview: parsed.some((item) => item.confidence === "low"),
  });
}

/** Beberapa penyedia melakukan verifikasi dengan GET. */
export async function GET() {
  return jsonOk({ ok: true, endpoint: "catatku-inbound-email" });
}
