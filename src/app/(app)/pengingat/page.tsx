import { PageHeader } from "@/components/ui/page-header";
import { ReminderSettings } from "@/components/reminders/reminder-settings";
import { requireUser } from "@/lib/auth";
import { getBudgetUsage, getReminder } from "@/lib/data";

export const metadata = { title: "Pengingat" };

export default async function PengingatPage() {
  const user = await requireUser();
  const reminder = await getReminder(user.id);
  const budgetUsage = await getBudgetUsage(user.id);

  return (
    <div>
      <PageHeader
        backHref="/"
        eyebrow="Kebiasaan"
        title="Pengingat"
        subtitle="Atur waktu mencatat dan peringatan batas belanja bulananmu."
      />
      <ReminderSettings
        reminder={reminder}
        usage={budgetUsage}
        currency={user.currency}
        userEmail={user.email}
      />
    </div>
  );
}
