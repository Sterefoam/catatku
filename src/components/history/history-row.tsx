"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { CategoryBadge } from "@/components/category-icon";
import { useApp } from "@/components/app/app-context";
import { MINUS, formatMoney } from "@/lib/money";
import type { TransactionDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

/** State pilih-banyak yang dibagikan ke setiap baris riwayat. */
export interface HistorySelection {
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

const HistorySelectionContext = React.createContext<HistorySelection | null>(null);

/**
 * Menyediakan state pilih-banyak ke baris riwayat. Bila `selection` bernilai
 * null (mode pilih nonaktif), baris kembali berperilaku biasa: ketuk = ubah.
 */
export function HistorySelectionProvider({
  selection,
  children,
}: {
  selection: HistorySelection | null;
  children: React.ReactNode;
}) {
  if (!selection) return <>{children}</>;
  return (
    <HistorySelectionContext.Provider value={selection}>
      {children}
    </HistorySelectionContext.Provider>
  );
}

/**
 * Satu baris transaksi pada riwayat.
 * Mode biasa: ketuk untuk membuka sheet ubah/hapus.
 * Mode pilih: ketuk untuk memilih/membatalkan pilihan (tanpa membuka sheet).
 */
export function HistoryRow({
  transaction,
  currency,
}: {
  transaction: TransactionDTO;
  currency: string;
}) {
  const { openEdit } = useApp();
  const selection = React.useContext(HistorySelectionContext);
  const selectionMode = selection !== null;
  const selected = selection ? selection.selectedIds.has(transaction.id) : false;

  const income = transaction.type === "income";
  const amount = formatMoney(transaction.amount, currency);
  const summary = `${income ? "Pemasukan" : "Pengeluaran"} ${transaction.category.name} ${amount}${
    transaction.note ? `, catatan ${transaction.note}` : ""
  }`;

  const ariaLabel = selectionMode
    ? `${summary}. ${selected ? "Terpilih" : "Belum dipilih"}. Ketuk untuk ${
        selected ? "membatalkan pilihan" : "memilih"
      }.`
    : `${summary}. Ketuk untuk mengubah atau menghapus.`;

  function handleClick() {
    if (selection) selection.onToggle(transaction.id);
    else openEdit(transaction);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? selected : undefined}
      aria-label={ariaLabel}
      className={cn(
        "group flex min-h-14 w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60",
        selected && "bg-primary-soft/60 hover:bg-primary-soft/70 focus-visible:bg-primary-soft/70",
      )}
    >
      {selectionMode ? (
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center transition-transform duration-150 active:scale-90"
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border-2 transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/50 bg-card",
            )}
          >
            {selected ? <Check className="size-3" strokeWidth={3.2} /> : null}
          </span>
        </span>
      ) : (
        <CategoryBadge
          icon={transaction.category.icon}
          color={transaction.category.color}
          size="md"
        />
      )}
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
