"use client";

import * as React from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import type { CategoryDTO, TxType } from "@/lib/types";

export type HistoryTypeFilter = "all" | TxType;

export interface HistoryFilterState {
  /** "all" atau id kategori. */
  categoryId: string;
  type: HistoryTypeFilter;
  /** "YYYY-MM-DD" atau string kosong bila tidak dipakai. */
  from: string;
  to: string;
}

export const EMPTY_HISTORY_FILTERS: HistoryFilterState = {
  categoryId: "all",
  type: "all",
  from: "",
  to: "",
};

/** Jumlah saringan yang sedang aktif (0 berarti tanpa saringan). */
export function countActiveFilters(filters: HistoryFilterState): number {
  let count = 0;
  if (filters.categoryId !== "all") count += 1;
  if (filters.type !== "all") count += 1;
  if (filters.from) count += 1;
  if (filters.to) count += 1;
  return count;
}

const TYPE_OPTIONS: { value: HistoryTypeFilter; label: string; tone: "default" | "income" | "expense" }[] = [
  { value: "all", label: "Semua", tone: "default" },
  { value: "income", label: "Masuk", tone: "income" },
  { value: "expense", label: "Keluar", tone: "expense" },
];

/**
 * Kontrol saringan kategori, jenis, dan rentang tanggal.
 * Dipakai inline di desktop dan di dalam sheet filter pada mobile.
 */
export function HistoryFilterFields({
  value,
  onChange,
  categories,
  idPrefix = "history-filter",
}: {
  value: HistoryFilterState;
  onChange: (next: HistoryFilterState) => void;
  categories: CategoryDTO[];
  idPrefix?: string;
}) {
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const incomeCategories = categories.filter((category) => category.type === "income");

  function patch(part: Partial<HistoryFilterState>) {
    onChange({ ...value, ...part });
  }

  // Jaga agar rentang tanggal selalu valid: "dari" tidak boleh melewati "sampai".
  function handleFrom(next: string) {
    const from = next;
    const to = value.to && next && next > value.to ? next : value.to;
    onChange({ ...value, from, to });
  }

  function handleTo(next: string) {
    const to = next;
    const from = value.from && next && next < value.from ? next : value.from;
    onChange({ ...value, from, to });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-category`}>Kategori</Label>
        <Select
          id={`${idPrefix}-category`}
          value={value.categoryId}
          onChange={(event) => patch({ categoryId: event.target.value })}
          className="h-11 text-[14px]"
          aria-label="Saring berdasarkan kategori"
        >
          <option value="all">Semua kategori</option>
          {expenseCategories.length > 0 ? (
            <optgroup label="Pengeluaran">
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {incomeCategories.length > 0 ? (
            <optgroup label="Pemasukan">
              {incomeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </Select>
      </div>

      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <span className="block text-[13px] font-semibold text-muted-foreground">Jenis</span>
        <Segmented<HistoryTypeFilter>
          ariaLabel="Saring jenis transaksi"
          value={value.type}
          onChange={(nextType) => patch({ type: nextType })}
          options={TYPE_OPTIONS}
          size="sm"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-from`}>Dari tanggal</Label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(event) => handleFrom(event.target.value)}
          className="h-11 px-3 text-[13px]"
          aria-label="Tanggal mulai"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-to`}>Sampai tanggal</Label>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => handleTo(event.target.value)}
          className="h-11 px-3 text-[13px]"
          aria-label="Tanggal akhir"
        />
      </div>
    </div>
  );
}
