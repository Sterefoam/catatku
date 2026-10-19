"use client";

import { CategoryBadge } from "@/components/category-icon";
import { useApp } from "@/components/app/app-context";
import { MINUS, formatMoney } from "@/lib/money";
import type { TransactionDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Satu baris transaksi pada riwayat. Ketuk untuk membuka sheet ubah/hapus. */
export function HistoryRow({
  transaction,
  currency,
}: {
  transaction: TransactionDTO;
  currency: string;
}) {
  const { openEdit } = useApp();
  const income = transaction.type === "income";
  const amount = formatMoney(transaction.amount, currency);

  return (
    <button
      type="button"
      onClick={() => openEdit(transaction)}
      className="group flex min-h-14 w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
      aria-label={`${income ? "Pemasukan" : "Pengeluaran"} ${transaction.category.name} ${amount}${
        transaction.note ? `, catatan ${transaction.note}` : ""
      }. Ketuk untuk mengubah atau menghapus.`}
    >
      <CategoryBadge
        icon={transaction.category.icon}
        color={transaction.category.color}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold leading-tight">
          {transaction.category.name}
        </p>
        {transaction.note ? (
          <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">
            {transaction.note}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          "money shrink-0 text-[14px] font-bold",
          income ? "text-success" : "text-danger",
        )}
      >
        {income ? "+" : MINUS}
        {amount}
      </span>
    </button>
  );
}
