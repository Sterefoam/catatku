import { PageHeader } from "@/components/ui/page-header";
import { SettingsView } from "@/components/settings/settings-view";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div>
      <PageHeader backHref="/" title="Pengaturan" subtitle="Profil, tampilan, data, dan integrasi." />
      <SettingsView
        user={user}
        bcaIntegration={{
          configured: Boolean(process.env.INBOUND_EMAIL_SECRET),
          email: user.email,
        }}
      />
    </div>
  );
}
