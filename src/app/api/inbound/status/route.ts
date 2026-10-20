import { jsonOk, requireApiUser } from "@/lib/api";

/**
 * Status integrasi email BCA untuk halaman Pengaturan.
 * Email penerima selalu mengikuti email akun yang sedang login.
 */
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const secretConfigured = Boolean(process.env.INBOUND_EMAIL_SECRET);

  return jsonOk({
    configured: secretConfigured,
    secretConfigured,
    currentUserEmail: auth.user.email,
    webhookPath: "/api/inbound/email",
  });
}
