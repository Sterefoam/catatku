import { PageHeader } from "@/components/ui/page-header";
import { SettingsView } from "@/components/settings/settings-view";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const user = await requireUser();

  const bcaIntegration = {
    configured: Boolean(process.env.INBOUND_EMAIL_SECRET && process.env.INBOUND_EMAIL_USER),
    secretConfigured: Boolean(process.env.INBOUND_EMAIL_SECRET),
    boundEmail: process.env.INBOUND_EMAIL_USER?.trim() || null,
    currentUserEmail: user.email,
  };

  return (
    <div>
      <PageHeader
        backHref="/"
        eyebrow="Akun"
        title="Pengaturan"
        subtitle="Atur profil, mata uang, tampilan, dan cadangan datamu."
      />
      <SettingsView user={user} bcaIntegration={bcaIntegration} />
    </div>
  );
}
