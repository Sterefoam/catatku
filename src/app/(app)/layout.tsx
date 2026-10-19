import { AppProvider } from "@/components/app/app-provider";
import { AppShell } from "@/components/app/app-shell";
import { requireUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const categories = await getCategories(user.id);

  return (
    <AppProvider user={user} categories={categories}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
