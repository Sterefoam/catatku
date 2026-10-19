"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Tag } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { CategoryCard } from "./category-card";
import { CategoryFormDialog } from "./category-form-dialog";
import type { CategoryDTO, TxType } from "@/lib/types";

interface CategoryDialogState {
  category: CategoryDTO | null;
  type: TxType;
}

interface CategoriesViewProps {
  categories: CategoryDTO[];
}

export function CategoriesView({ categories }: CategoriesViewProps) {
  const { refresh } = useApp();
  const [tab, setTab] = React.useState<TxType>("expense");
  const [dialog, setDialog] = React.useState<CategoryDialogState | null>(null);

  const expenseCategories = React.useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );
  const incomeCategories = React.useMemo(
    () => categories.filter((category) => category.type === "income"),
    [categories],
  );
  const visibleCategories = tab === "expense" ? expenseCategories : incomeCategories;
  const usedInTransactions = React.useMemo(
    () =>
      categories.reduce((total, category) => total + (category.transactionCount ?? 0), 0),
    [categories],
  );

  function openCreate() {
    setDialog({ category: null, type: tab });
  }

  function openEdit(category: CategoryDTO) {
    setDialog({ category, type: category.type });
  }

  function handleCommitted() {
    setDialog(null);
    refresh();
  }

  const tabLabel = tab === "expense" ? "pengeluaran" : "pemasukan";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kategori"
        subtitle="Kelompokkan pengeluaran dan pemasukan supaya mudah dilacak."
        eyebrow="Atur gaya belanjamu"
        action={
          <Button onClick={openCreate} className="h-10 px-3.5 sm:px-4">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Tambah kategori</span>
            <span className="sm:hidden">Tambah</span>
          </Button>
        }
      />

      <Card className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Tag className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">
              {categories.length} kategori
            </p>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {usedInTransactions} transaksi memakai kategori ini
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11.5px]">
          <span className="inline-flex items-center gap-1 font-medium text-danger">
            <ArrowUpRight className="size-3.5" /> {expenseCategories.length} pengeluaran
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <ArrowDownLeft className="size-3.5" /> {incomeCategories.length} pemasukan
          </span>
        </div>
      </Card>

      <div className="space-y-3.5">
        <Segmented
          ariaLabel="Jenis kategori"
          value={tab}
          onChange={setTab}
          options={[
            {
              value: "expense",
              label: `Pengeluaran (${expenseCategories.length})`,
              tone: "expense",
              icon: <ArrowUpRight className="size-4" />,
            },
            {
              value: "income",
              label: `Pemasukan (${incomeCategories.length})`,
              tone: "income",
              icon: <ArrowDownLeft className="size-4" />,
            },
          ]}
        />

        {visibleCategories.length === 0 ? (
          <EmptyState
            icon={<Tag className="size-6" />}
            title={`Belum ada kategori ${tabLabel}`}
            description={`Tambahkan kategori ${tabLabel} supaya tiap transaksi punya tempat yang jelas.`}
            action={
              <Button variant="soft" onClick={openCreate}>
                <Plus className="size-4" /> Tambah kategori
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visibleCategories.map((category) => (
              <CategoryCard key={category.id} category={category} onSelect={openEdit} />
            ))}
          </div>
        )}

        <p className="px-1 text-[11.5px] leading-relaxed text-muted-foreground">
          Ketuk kartu kategori untuk mengubah nama, ikon, atau warnanya. Kategori bawaan boleh
          diubah dan dihapus. Kategori yang sudah dipakai transaksi hanya bisa dihapus setelah
          transaksinya dipindahkan.
        </p>
      </div>

      {dialog ? (
        <CategoryFormDialog
          key={dialog.category?.id ?? `new-${dialog.type}`}
          category={dialog.category}
          initialType={dialog.type}
          onClose={() => setDialog(null)}
          onCommitted={handleCommitted}
        />
      ) : null}
    </div>
  );
}
