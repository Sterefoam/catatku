"use client";

import * as React from "react";
import type { CategoryDTO, SessionUser, TransactionDTO, TxType } from "@/lib/types";

export interface QuickAddState {
  open: boolean;
  editing: TransactionDTO | null;
  type: TxType;
}

export interface AppContextValue {
  user: SessionUser;
  categories: CategoryDTO[];
  currency: string;
  quickAdd: QuickAddState;
  openCreate: (type?: TxType) => void;
  openEdit: (transaction: TransactionDTO) => void;
  closeQuickAdd: () => void;
  refresh: () => void;
}

export const AppContext = React.createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error("useApp harus dipakai di dalam AppProvider.");
  }
  return context;
}

export function useCategoriesFor(type: TxType): CategoryDTO[] {
  const { categories } = useApp();
  return React.useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );
}
