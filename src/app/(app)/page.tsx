import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  PiggyBank,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  QuickAddButton,
} from "@/components/transactions/quick-add-button";
import {
  RecentTransactionList,
  SectionHeading,
} from "@/components/transactions/transaction-list";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";
import { currentHourJakarta, formatDateLong, todayISO } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import type { BudgetUsageDTO, SummaryDTO } from "@/lib/types";
import { cn, greetingForHour, initials } from "@/lib/utils";

export const metadata = { title: "Beranda" };

function BalanceHero({ summary, currency }: { summary: SummaryDTO; currency: string }) {
  const negative = summary.balance < 0;
  return (
    <section className="hero-card relative overflow-hidden rounded-[1.8rem] p-5 text-white sm:p-6">
      <span className="pointer-events-none absolute -right-12 -top-20 size-52 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-28 -left-14 size-64 rounded-full bg-white/[0.06]" />
      <span className="pointer-events-none absolute right-8 top-16 size-2 rounded-full bg-white/40" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/75">
            <Wallet className="size-4" /> Sisa uang sekarang
          </span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-semibold tracking-wide backdrop-blur">
            {summary.monthLabel}
          </span>
        </div>

        <p
          className={cn(
            "money mt-2.5 text-[37px] font-bold leading-none tracking-tight sm:text-[44px]",
            negative && "text-[#ffd9d2]",
          )}
        >
          {formatMoney(summary.balance, currency)}
        </p>

        <p className="mt-2.5 max-w-[24rem] text-[12px] leading-relaxed text-white/70">
          {negative
            ? "Sisa uangmu sedang minus. Catat pengeluaran berikutnya dengan lebih hati-hati ya."
            : summary.monthNet >= 0
              ? `Bulan ini surplus ${formatMoney(summary.monthNet, currency)}. Pertahankan ritmenya.`
              : `Bulan ini defisit ${formatMoney(Math.abs(summary.monthNet), currency)}. Masih bisa dirapikan.`}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <QuickAddButton
            size="sm"
            type="expense"
            label="Catat pengeluaran"
            className="bg-white text-[#0b5c42] shadow-none hover:bg-white/90"
          />
          <QuickAddButton
            size="sm"
            type="income"
            label="Catat pemasukan"
            variant="outline"
            className="border-white/25 bg-white/10 text-white hover:bg-white/20"
          />
        </div>
      </div>
    </section>
  );
}

function MonthCards({ summary, currency }: { summary: SummaryDTO; currency: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-success-soft text-success">
            <ArrowDownLeft className="size-4" />
          </span>
          <p className="text-[12px] font-medium text-muted-foreground">Pemasukan</p>
        </div>
        <p className="money mt-2.5 text-[19px] font-bold leading-tight text-success">
          +{formatMoney(summary.monthIncome, currency)}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{summary.monthLabel}</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <ArrowUpRight className="size-4" />
          </span>
          <p className="text-[12px] font-medium text-muted-foreground">Pengeluaran</p>
        </div>
        <p className="money mt-2.5 text-[19px] font-bold leading-tight text-danger">
          {formatMoney(summary.monthExpense, currency)}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{summary.monthLabel}</p>
      </Card>
    </div>
  );
}

function BudgetCard({ usage, currency }: { usage: BudgetUsageDTO; currency: string }) {
  const hasBudget = Boolean(usage.budget);
  const tone = usage.status === "over" ? "danger" : usage.status === "warning" ? "warning" : "primary";
  const statusLabel =
    usage.status === "over"
      ? "Melewati batas"
      : usage.status === "warning"
        ? "Mendekati batas"
        : "Masih aman";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <Target className="size-[18px]" />
          </span>
          <div>
            <p className="text-[13px] font-semibold">Batas belanja bulan ini</p>
            <p className="text-[11.5px] text-muted-foreground">
              {hasBudget
                ? `${formatMoney(usage.spent, currency)} dari ${formatMoney(usage.budget?.limitAmount ?? 0, currency)}`
                : "Belum diatur — pasang pagar pengeluaranmu"}
            </p>
          </div>
        </div>
        <Link
          href="/target"
          className="shrink-0 rounded-full bg-primary-soft px-3 py-1.5 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary-soft/70"
        >
          {hasBudget ? "Ubah" : "Atur"}
        </Link>
      </div>

      {hasBudget ? (
        <div className="mt-3.5">
          <Progress value={usage.percent} tone={tone} />
          <div className="mt-2 flex items-center justify-between text-[11.5px]">
            <span
              className={cn(
                "font-semibold",
                usage.status === "over" ? "text-danger" : usage.status === "warning" ? "text-warning" : "text-muted-foreground",
              )}
            >
              {statusLabel} · {usage.percent}%
            </span>
            <span className="text-muted-foreground">
              {usage.remaining >= 0
                ? `Sisa ${formatMoney(usage.remaining, currency)}`
                : `Lewat ${formatMoney(Math.abs(usage.remaining), currency)}`}
            </span>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function WelcomeCard() {
  return (
    <section className="hero-card relative overflow-hidden rounded-[1.8rem] p-6 text-white">
      <span className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-white/[0.06]" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-semibold tracking-wide">
          <Sparkles className="size-3" /> Mulai dari sini
        </span>
        <h2 className="mt-3.5 text-[26px] font-bold leading-tight tracking-tight">
          Catat uang pertamamu,
          <br />
          biar tidak hilang tanpa jejak.
        </h2>
        <p className="mt-2 max-w-[22rem] text-[12.5px] leading-relaxed text-white/75">
          Satu transaksi butuh beberapa detik. Sisa uang, arus kas, dan grafikmu akan
          terisi otomatis.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <QuickAddButton
            size="sm"
            type="expense"
            label="Catat pengeluaran"
            className="bg-white text-[#0b5c42] shadow-none hover:bg-white/90"
          />
          <QuickAddButton
            size="sm"
            type="income"
            label="Catat pemasukan"
            variant="outline"
            className="border-white/25 bg-white/10 text-white hover:bg-white/20"
          />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4 text-[10.5px] text-white/70">
          <span className="flex items-center gap-1.5">
            <Wallet className="size-3.5 shrink-0" /> Sisa uang otomatis
          </span>
          <span className="flex items-center gap-1.5">
            <PiggyBank className="size-3.5 shrink-0" /> Target tabungan
          </span>
          <span className="flex items-center gap-1.5">
            <BellRing className="size-3.5 shrink-0" /> Pengingat harian
          </span>
        </div>
      </div>
    </section>
  );
}

function GoalsPreview({
  goals,
  currency,
}: {
  goals: { id: string; name: string; progress: number; savedAmount: number; targetAmount: number }[];
  currency: string;
}) {
  return (
    <section>
      <SectionHeading title="Target tabungan" href="/target" hrefLabel="Kelola" />
      <Card className="divide-y divide-border/60 px-4 py-1">
        {goals.map((goal) => (
          <Link
            key={goal.id}
            href="/target"
            className="flex items-center gap-3 py-3 transition-opacity hover:opacity-90"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <PiggyBank className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-[13px] font-semibold">{goal.name}</p>
                <p className="shrink-0 text-[12px] font-bold text-primary">{goal.progress}%</p>
              </div>
              <Progress value={goal.progress} className="mt-2 h-1.5" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatMoney(goal.savedAmount, currency)} / {formatMoney(goal.targetAmount, currency)}
              </p>
            </div>
          </Link>
        ))}
      </Card>
    </section>
  );
}

export default async function HomePage() {
  const user = await requireUser();
  const { summary, recent, budgetUsage, goals } = getDashboardData(user.id);
  const currency = user.currency;
  const firstName = user.name.split(" ")[0] ?? user.name;
  const greeting = greetingForHour(currentHourJakarta());
  const isNewUser = summary.transactionCount === 0;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-medium text-muted-foreground">
            {formatDateLong(todayISO())}
          </p>
          <h1 className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight sm:text-[25px]">
            {greeting}, {firstName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href="/pengaturan"
            aria-label="Buka profil dan pengaturan"
            className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-[12.5px] font-bold text-primary transition-colors hover:bg-muted"
          >
            {initials(user.name)}
          </Link>
        </div>
      </header>

      {isNewUser ? (
        <WelcomeCard />
      ) : (
        <>
          <BalanceHero summary={summary} currency={currency} />
          <MonthCards summary={summary} currency={currency} />
          <BudgetCard usage={budgetUsage} currency={currency} />
        </>
      )}

      <section>
        <SectionHeading title="Transaksi terakhir" href="/riwayat" />
        <Card className="p-2 sm:p-3">
          <RecentTransactionList transactions={recent} />
        </Card>
      </section>

      {goals.length > 0 ? <GoalsPreview goals={goals} currency={currency} /> : null}

      {isNewUser ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-[12px] text-muted-foreground">
          <span>Butuh inspirasi? Lihat contoh aplikasi yang sudah terisi.</span>
          <Link
            href="/login"
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
          >
            Akun demo <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
