import { PageHeader } from "@/components/ui/page-header";
import { SettingsView } from "@/components/settings/settings-view";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div>
      <PageHeader
        backHref="/"
        eyebrow="Akun"
        title="Pengaturan"
        subtitle="Atur profil, mata uang, tampilan, dan cadangan datamu."
      />
      <SettingsView user={user} />
    </div>
  );
}
