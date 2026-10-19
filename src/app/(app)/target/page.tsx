import { BudgetSection } from "@/components/budget/budget-section";
import { GoalsSection } from "@/components/goals/goals-section";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getBudgetUsage, getGoals } from "@/lib/data";

export const metadata = { title: "Target & Progres" };

export default async function TargetPage() {
  const user = await requireUser();
  const goals = await getGoals(user.id);
  const budgetUsage = await getBudgetUsage(user.id);

  // Contoh nominal untuk empty state: dana darurat ±6× pengeluaran bulan ini.
  const emergencySuggestion =
    budgetUsage.spent > 0
      ? budgetUsage.spent * 6
      : budgetUsage.budget
        ? budgetUsage.budget.limitAmount * 6
        : null;

  return (
    <div>
      <PageHeader
        eyebrow="Rencana keuangan"
        title="Target & Progres"
        subtitle="Tetapkan tujuan tabungan dan pagar belanja supaya uangmu bergerak ke arah yang benar."
      />
      <div className="space-y-6">
        <BudgetSection usage={budgetUsage} />
        <GoalsSection goals={goals} emergencySuggestion={emergencySuggestion} />
      </div>
    </div>
  );
}
