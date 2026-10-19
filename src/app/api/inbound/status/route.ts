import { jsonOk, requireApiUser } from "@/lib/api";

/** Status konfigurasi integrasi email BCA untuk halaman Pengaturan. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const secretConfigured = Boolean(process.env.INBOUND_EMAIL_SECRET);
  const boundEmail = process.env.INBOUND_EMAIL_USER?.trim() || null;

  return jsonOk({
    configured: secretConfigured && Boolean(boundEmail),
    secretConfigured,
    boundEmail,
    currentUserEmail: auth.user.email,
    webhookPath: "/api/inbound/email",
    providerHint: "Postmark / Mailgun / SendGrid inbound webhook",
  });
}
