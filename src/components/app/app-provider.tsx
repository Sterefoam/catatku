"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { CategoryDTO, SessionUser, TransactionDTO, TxType } from "@/lib/types";
import { AppContext, type AppContextValue, type QuickAddState } from "./app-context";
import { TransactionSheet } from "@/components/transactions/transaction-sheet";

const CLOSED: QuickAddState = { open: false, editing: null, type: "expense" };

export function AppProvider({
  user,
  categories,
  children,
}: {
  user: SessionUser;
  categories: CategoryDTO[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [quickAdd, setQuickAdd] = React.useState<QuickAddState>(CLOSED);

  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const openCreate = React.useCallback((type: TxType = "expense") => {
    setQuickAdd({ open: true, editing: null, type });
  }, []);

  const openEdit = React.useCallback((transaction: TransactionDTO) => {
    setQuickAdd({ open: true, editing: transaction, type: transaction.type });
  }, []);

  const closeQuickAdd = React.useCallback(() => {
    setQuickAdd(CLOSED);
  }, []);

  const value = React.useMemo<AppContextValue>(
    () => ({
      user,
      categories,
      currency: user.currency,
      quickAdd,
      openCreate,
      openEdit,
      closeQuickAdd,
      refresh,
    }),
    [user, categories, quickAdd, openCreate, openEdit, closeQuickAdd, refresh],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      {quickAdd.open ? (
        <TransactionSheet
          key={quickAdd.editing?.id ?? `new-${quickAdd.type}`}
          editing={quickAdd.editing}
          initialType={quickAdd.type}
        />
      ) : null}
    </AppContext.Provider>
  );
}
