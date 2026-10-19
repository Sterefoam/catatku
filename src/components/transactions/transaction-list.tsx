"use client";

import Link from "next/link";
import { ChevronRight, Plus, ReceiptText } from "lucide-react";
import { CategoryBadge } from "@/components/category-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app/app-context";
import { formatDayLabel } from "@/lib/date";
import { MINUS, formatMoney } from "@/lib/money";
import type { TransactionDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TransactionRow({
  transaction,
  showDate = true,
}: {
  transaction: TransactionDTO;
  showDate?: boolean;
}) {
  const { currency, openEdit } = useApp();
  const income = transaction.type === "income";
  const meta = [transaction.note, showDate ? formatDayLabel(transaction.date) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={() => openEdit(transaction)}
      className="group flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-left transition-colors hover:bg-muted/60"
      aria-label={`${transaction.category.name} ${formatMoney(transaction.amount, currency)}`}
    >
      <CategoryBadge icon={transaction.category.icon} color={transaction.category.color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold leading-tight">
          {transaction.category.name}
        </p>
        {meta ? (
          <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">{meta}</p>
        ) : null}
      </div>
      <span
        className={cn(
          "money shrink-0 text-[14px] font-bold",
          income ? "text-success" : "text-foreground",
        )}
      >
        {income ? "+" : MINUS}
        {formatMoney(transaction.amount, currency)}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

export function RecentTransactionList({ transactions }: { transactions: TransactionDTO[] }) {
  const { openCreate } = useApp();

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptText className="size-6" />}
        title="Belum ada transaksi"
        description="Catat pengeluaran atau pemasukan pertamamu, nanti langsung muncul di sini."
        action={
          <Button size="sm" onClick={() => openCreate("expense")}>
            <Plus className="size-4" /> Catat transaksi
          </Button>
        }
        compact
      />
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {transactions.map((transaction) => (
        <TransactionRow key={transaction.id} transaction={transaction} />
      ))}
    </div>
  );
}

export function SectionHeading({
  title,
  href,
  hrefLabel = "Lihat semua",
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-primary hover:underline"
        >
          {hrefLabel}
          <ChevronRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
