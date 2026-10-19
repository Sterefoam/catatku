import type { RangeKey } from "./date";

export type TxType = "income" | "expense";
export type ThemeMode = "light" | "dark";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  currency: string;
  theme: ThemeMode;
  createdAt: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  type: TxType;
  icon: string;
  color: string;
  isDefault: boolean;
  transactionCount?: number;
}

export interface CategoryRef {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TxType;
}

export interface TransactionDTO {
  id: string;
  categoryId: string;
  type: TxType;
  amount: number;
  note: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
  category: CategoryRef;
}

export interface SummaryDTO {
  balance: number;
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  month: string;
  monthLabel: string;
  transactionCount: number;
}

export interface GoalDTO {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  progress: number;
  remaining: number;
}

export interface BudgetDTO {
  id: string;
  userId: string;
  categoryId: string | null;
  limitAmount: number;
  period: string;
}

export type BudgetStatus = "none" | "safe" | "warning" | "over";

export interface BudgetUsageDTO {
  budget: BudgetDTO | null;
  spent: number;
  remaining: number;
  percent: number;
  status: BudgetStatus;
  period: string;
  periodLabel: string;
}

export interface ReminderDTO {
  id: string | null;
  time: string;
  days: string[];
  isActive: boolean;
  budgetAlertEnabled: boolean;
}

export interface ChartBucketDTO {
  key: string;
  label: string;
  income: number;
  expense: number;
}

export interface CategorySliceDTO {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  share: number;
}

export interface ChartsDTO {
  range: RangeKey;
  start: string;
  end: string;
  label: string;
  totals: {
    income: number;
    expense: number;
    net: number;
  };
  series: ChartBucketDTO[];
  categories: CategorySliceDTO[];
}

export interface ApiErrorBody {
  error: string;
  details?: Record<string, string>;
}

export interface TransactionInput {
  type: TxType;
  amount: number;
  categoryId: string;
  date: string;
  note?: string | null;
}
