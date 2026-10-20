"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  Loader2,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  SearchX,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { apiErrorMessage, apiPost } from "@/lib/client-api";
import { formatDayLabel } from "@/lib/date";
import { MINUS, formatMoney } from "@/lib/money";
import type { CategoryDTO, TransactionDTO } from "@/lib/types";
import {
  EMPTY_HISTORY_FILTERS,
  HistoryFilterFields,
  countActiveFilters,
  type HistoryFilterState,
} from "./history-filters";
import { HistoryGroup } from "./history-group";
import { HistorySelectionProvider, type HistorySelection } from "./history-row";

const BATCH_SIZE = 30;

interface HistoryDateGroup {
  date: string;
  items: TransactionDTO[];
}

function sortNewestFirst(a: TransactionDTO, b: TransactionDTO): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/** Kelompokkan transaksi per tanggal dengan urutan tanggal menurun. */
function groupByDate(transactions: TransactionDTO[]): HistoryDateGroup[] {
  const groups = new Map<string, TransactionDTO[]>();
  for (const transaction of transactions) {
    const existing = groups.get(transaction.date);
    if (existing) existing.push(transaction);
    else groups.set(transaction.date, [transaction]);
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }));
}

function SummaryCards({
  income,
  expense,
  incomeCount,
  expenseCount,
  currency,
  isFiltered,
}: {
  income: number;
  expense: number;
  incomeCount: number;
  expenseCount: number;
  currency: string;
  isFiltered: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Ringkasan transaksi yang tampil">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-success-soft text-success">
            <ArrowDownLeft className="size-4" />
          </span>
          <p className="text-[12px] font-medium text-muted-foreground">Pemasukan</p>
        </div>
        <p className="money mt-2.5 text-[19px] font-bold leading-tight text-success">
          {income > 0 ? "+" : ""}
          {formatMoney(income, currency)}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {incomeCount} catatan
          {isFiltered ? " · hasil saringan" : ""}
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <ArrowUpRight className="size-4" />
          </span>
          <p className="text-[12px] font-medium text-muted-foreground">Pengeluaran</p>
        </div>
        <p className="money mt-2.5 text-[19px] font-bold leading-tight text-danger">
          {MINUS}
          {formatMoney(expense, currency)}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {expenseCount} catatan
          {isFiltered ? " · hasil saringan" : ""}
        </p>
      </Card>
    </div>
  );
}

/**
 * Tampilan halaman Riwayat: pencarian instan, saringan, pengelompokan per
 * tanggal, dan muat lebih banyak — semuanya di sisi klien dari data server.
 */
export function HistoryView({
  transactions,
  categories,
  currency,
  today,
}: {
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  currency: string;
  today: string;
}) {
  const { openCreate, refresh } = useApp();

  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<HistoryFilterState>(EMPTY_HISTORY_FILTERS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [batchLimit, setBatchLimit] = React.useState(BATCH_SIZE);

  // Mode pilih-banyak + hapus massal.
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set<string>());
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const filterCount = countActiveFilters(filters);
  const hasActiveSearch = filterCount > 0 || normalizedQuery.length > 0;

  const filtered = React.useMemo(() => {
    return transactions
      .filter((transaction) => {
        if (filters.type !== "all" && transaction.type !== filters.type) return false;
        if (filters.categoryId !== "all" && transaction.categoryId !== filters.categoryId) {
          return false;
        }
        if (filters.from && transaction.date < filters.from) return false;
        if (filters.to && transaction.date > filters.to) return false;
        if (normalizedQuery) {
          const haystack = `${transaction.note ?? ""} ${transaction.category.name}`.toLowerCase();
          if (!haystack.includes(normalizedQuery)) return false;
        }
        return true;
      })
      .sort(sortNewestFirst);
  }, [transactions, filters, normalizedQuery]);

  // Dasar "Pilih semua": semua transaksi yang cocok dengan pencarian/saringan
  // saat ini — bukan hanya batch yang sudah tampil di layar.
  const filteredIds = React.useMemo(() => filtered.map((transaction) => transaction.id), [filtered]);
  const selectedCount = selectedIds.size;
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const stats = React.useMemo(() => {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    for (const transaction of filtered) {
      if (transaction.type === "income") {
        income += transaction.amount;
        incomeCount += 1;
      } else {
        expense += transaction.amount;
        expenseCount += 1;
      }
    }
    return { income, expense, incomeCount, expenseCount };
  }, [filtered]);

  const groups = React.useMemo(() => groupByDate(filtered), [filtered]);

  // Tampilkan kelompok secara utuh, bertahap sekitar 30 transaksi per batch.
  const visibleGroupCount = React.useMemo(() => {
    let count = 0;
    let total = 0;
    for (const group of groups) {
      count += 1;
      total += group.items.length;
      if (total >= batchLimit) break;
    }
    return count;
  }, [groups, batchLimit]);

  const visibleGroups = groups.slice(0, visibleGroupCount);
  const shownCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);
  const hasMore = visibleGroupCount < groups.length;
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const updateFilters = React.useCallback((next: HistoryFilterState) => {
    setFilters(next);
    setBatchLimit(BATCH_SIZE);
  }, []);

  const resetFilters = React.useCallback(() => {
    setFilters(EMPTY_HISTORY_FILTERS);
    setBatchLimit(BATCH_SIZE);
  }, []);

  const resetAll = React.useCallback(() => {
    setQuery("");
    setFilters(EMPTY_HISTORY_FILTERS);
    setBatchLimit(BATCH_SIZE);
  }, []);

  const loadMore = React.useCallback(() => {
    setBatchLimit((current) => current + BATCH_SIZE);
  }, []);

  const toggleSelected = React.useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const enterSelectionMode = React.useCallback(() => {
    setSelectedIds(new Set<string>());
    setSelectionMode(true);
  }, []);

  const exitSelectionMode = React.useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set<string>());
    setDeleteOpen(false);
  }, []);

  const toggleSelectAllFiltered = React.useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected =
        filteredIds.length > 0 && filteredIds.every((id) => next.has(id));
      for (const id of filteredIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, [filteredIds]);

  const selection = React.useMemo<HistorySelection | null>(
    () => (selectionMode ? { selectedIds, onToggle: toggleSelected } : null),
    [selectionMode, selectedIds, toggleSelected],
  );

  async function handleDeleteSelected() {
    if (deleting || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    setDeleting(true);
    try {
      const result = await apiPost<{ deleted: number }>("/api/transactions/bulk-delete", { ids });
      const deleted =
        typeof result?.deleted === "number" && Number.isFinite(result.deleted)
          ? result.deleted
          : ids.length;
      toast.success(`${deleted} transaksi dihapus.`);
      // Berhasil: tutup dialog, keluar mode pilih, bersihkan pilihan, muat ulang data.
      setDeleteOpen(false);
      setSelectionMode(false);
      setSelectedIds(new Set<string>());
      refresh();
    } catch (error) {
      // Gagal: dialog tetap terbuka agar pengguna bisa mencoba lagi.
      toast.error(apiErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  function handleQueryChange(event: React.ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setBatchLimit(BATCH_SIZE);
  }

  function clearQuery() {
    setQuery("");
    setBatchLimit(BATCH_SIZE);
  }

  // Muat batch berikutnya otomatis saat pengguna menggulir mendekati bawah daftar.
  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setBatchLimit((current) => current + BATCH_SIZE);
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, shownCount, visibleGroupCount]);

  function chipDateLabel(day: string): string {
    const label = formatDayLabel(day, today);
    return label === "Hari ini" || label === "Kemarin" ? label.toLowerCase() : label;
  }

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.categoryId !== "all") {
    const category = categories.find((item) => item.id === filters.categoryId);
    activeChips.push({
      key: "category",
      label: `Kategori: ${category?.name ?? "dipilih"}`,
      onRemove: () => updateFilters({ ...filters, categoryId: "all" }),
    });
  }
  if (filters.type !== "all") {
    activeChips.push({
      key: "type",
      label: filters.type === "income" ? "Jenis: Pemasukan" : "Jenis: Pengeluaran",
      onRemove: () => updateFilters({ ...filters, type: "all" }),
    });
  }
  if (filters.from) {
    activeChips.push({
      key: "from",
      label: `Dari ${chipDateLabel(filters.from)}`,
      onRemove: () => updateFilters({ ...filters, from: "" }),
    });
  }
  if (filters.to) {
    activeChips.push({
      key: "to",
      label: `Sampai ${chipDateLabel(filters.to)}`,
      onRemove: () => updateFilters({ ...filters, to: "" }),
    });
  }

  const subtitle =
    transactions.length === 0
      ? "Semua catatan uangmu akan terkumpul rapi di sini."
      : hasActiveSearch
        ? `${filtered.length} dari ${transactions.length} transaksi cocok`
        : `${transactions.length} transaksi tercatat · terbaru di atas`;

  return (
    <div className="space-y-4">
      <PageHeader title="Riwayat" subtitle={subtitle} className="pb-1" />

      {transactions.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="size-6" />}
          title="Belum ada transaksi"
          description="Mulai catat pengeluaran atau pemasukan pertamamu. Semua riwayat akan tersusun rapi per hari di sini."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => openCreate("expense")}>
                <Plus className="size-4" /> Catat pengeluaran
              </Button>
              <Button variant="outline" onClick={() => openCreate("income")}>
                Catat pemasukan
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div role="search" className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="Cari catatan atau kategori..."
                className="h-11 pl-10 pr-11 text-[14px]"
                aria-label="Cari transaksi berdasarkan catatan atau nama kategori"
                autoComplete="off"
                enterKeyHint="search"
              />
              {query ? (
                <button
                  type="button"
                  onClick={clearQuery}
                  className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Hapus kata kunci pencarian"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            {!selectionMode ? (
              <Button
                type="button"
                variant="outline"
                onClick={enterSelectionMode}
                className="h-11 shrink-0 gap-1.5 px-3"
                aria-label="Pilih beberapa transaksi untuk dihapus"
              >
                <CheckSquare className="size-4" aria-hidden />
                <span className="hidden text-[13px] font-semibold sm:inline">Pilih</span>
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltersOpen(true)}
              className="relative h-11 shrink-0 gap-1.5 px-3 sm:hidden"
              aria-label={
                filterCount > 0
                  ? `Buka saringan transaksi, ${filterCount} saringan aktif`
                  : "Buka saringan transaksi"
              }
            >
              <SlidersHorizontal className="size-4" />
              <span className="text-[13px] font-semibold">Filter</span>
              {filterCount > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10.5px] font-bold leading-5 text-primary-foreground">
                  {filterCount}
                </span>
              ) : null}
            </Button>
          </div>

          {selectionMode ? (
            <div
              className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 rounded-2xl border border-primary/30 bg-card/95 px-2.5 py-2 shadow-[0_12px_32px_-22px_rgba(8,35,25,0.55)] backdrop-blur"
              role="group"
              aria-label="Mode pilih transaksi"
            >
              <p className="flex min-w-0 items-center gap-2 pl-0.5">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
                >
                  <CheckSquare className="size-4" />
                </span>
                <span className="min-w-0">
                  <span
                    aria-live="polite"
                    aria-atomic="true"
                    className="block text-[13px] font-bold leading-tight"
                  >
                    {selectedCount} dipilih
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">
                    {filtered.length} transaksi cocok dengan saringan
                  </span>
                </span>
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="soft"
                  onClick={toggleSelectAllFiltered}
                  disabled={filtered.length === 0}
                  className="h-10 gap-1.5 px-3 text-[12.5px]"
                  aria-label={
                    allFilteredSelected
                      ? `Batalkan pilihan semua ${filtered.length} transaksi yang cocok`
                      : `Pilih semua ${filtered.length} transaksi yang cocok`
                  }
                >
                  {allFilteredSelected ? (
                    <CheckCheck className="size-4" aria-hidden />
                  ) : (
                    <CheckSquare className="size-4" aria-hidden />
                  )}
                  {allFilteredSelected ? "Batalkan semua" : "Pilih semua"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={exitSelectionMode}
                  className="h-10 gap-1 px-2.5 text-[12.5px]"
                >
                  <X className="size-4" aria-hidden /> Batal
                </Button>
              </div>
            </div>
          ) : null}

          <div className="hidden sm:block">
            <Card className="p-3">
              <HistoryFilterFields
                value={filters}
                onChange={updateFilters}
                categories={categories}
                idPrefix="history-desktop"
              />
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {filtered.length} transaksi cocok
                  </p>
                  {filterCount > 0 ? (
                    <Badge tone="primary">{filterCount} filter aktif</Badge>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  disabled={filterCount === 0}
                  className="h-9 px-2.5 text-[12px] text-primary disabled:text-muted-foreground"
                >
                  <RotateCcw className="size-3.5" /> Reset filter
                </Button>
              </div>
            </Card>
          </div>

          {activeChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex min-h-10 items-center gap-1 rounded-full bg-primary-soft px-3 py-1.5 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary-soft/70"
                  aria-label={`Hapus saringan ${chip.label}`}
                >
                  {chip.label}
                  <X className="size-3" aria-hidden />
                </button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-8 px-2 text-[11.5px] text-primary"
              >
                Reset filter
              </Button>
            </div>
          ) : null}

          {filtered.length > 0 ? (
            <SummaryCards
              income={stats.income}
              expense={stats.expense}
              incomeCount={stats.incomeCount}
              expenseCount={stats.expenseCount}
              currency={currency}
              isFiltered={hasActiveSearch}
            />
          ) : null}

          {filtered.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="Tidak ada transaksi yang cocok"
              description="Coba kata kunci lain, longgarkan saringan, atau reset semuanya."
              action={
                <Button variant="outline" size="sm" onClick={resetAll}>
                  <RotateCcw className="size-4" /> Reset pencarian &amp; filter
                </Button>
              }
            />
          ) : (
            <>
              <HistorySelectionProvider selection={selection}>
                <div className="space-y-4">
                  {visibleGroups.map((group) => (
                    <HistoryGroup
                      key={group.date}
                      date={group.date}
                      transactions={group.items}
                      currency={currency}
                      today={today}
                    />
                  ))}
                </div>
              </HistorySelectionProvider>

              <div className="flex flex-col items-center gap-2 pt-1">
                {hasMore ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadMore}
                    className="w-full sm:w-auto"
                  >
                    <ChevronDown className="size-4" /> Muat lebih banyak
                  </Button>
                ) : null}
                <p className="text-center text-[11.5px] text-muted-foreground" aria-live="polite">
                  {shownCount < filtered.length
                    ? `Menampilkan ${shownCount} dari ${filtered.length} transaksi`
                    : `Semua ${filtered.length} transaksi sudah tampil`}
                </p>
                {hasMore ? <div ref={sentinelRef} aria-hidden className="h-2 w-full" /> : null}
              </div>
            </>
          )}

          {selectionMode ? (
            <div
              className="sticky bottom-2 z-30 max-lg:bottom-[calc(env(safe-area-inset-bottom,0px)_+_5.5rem)]"
              role="region"
              aria-label="Aksi transaksi terpilih"
            >
              <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card/95 p-2 pl-4 shadow-[0_18px_44px_-22px_rgba(8,35,25,0.6)] backdrop-blur">
                <p className="min-w-0 flex-1 text-[13px] font-semibold leading-tight">
                  {selectedCount} transaksi dipilih
                  <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
                    {selectedCount === 0
                      ? "Ketuk baris untuk memilih transaksi."
                      : "Ketuk Hapus untuk melanjutkan."}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setDeleteOpen(true)}
                  disabled={selectedCount === 0}
                  className="h-11 shrink-0 gap-1.5 px-4"
                >
                  <Trash2 className="size-4" aria-hidden /> Hapus
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saring transaksi</DialogTitle>
            <DialogDescription>
              Gabungkan kategori, jenis, dan rentang tanggal. Hasil langsung menyesuaikan.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <HistoryFilterFields
              value={filters}
              onChange={updateFilters}
              categories={categories}
              idPrefix="history-mobile"
            />
            <p className="text-[12px] text-muted-foreground">
              {filtered.length} transaksi cocok dengan saringan ini.
            </p>
          </DialogBody>
          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={resetFilters}
              disabled={filterCount === 0}
            >
              Reset filter
            </Button>
            <Button type="button" className="flex-1" onClick={() => setFiltersOpen(false)}>
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          // Jangan biarkan dialog tertutup saat proses hapus masih berjalan.
          if (deleting) return;
          setDeleteOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus {selectedCount} transaksi?</DialogTitle>
            <DialogDescription>Tindakan ini tidak bisa dibatalkan.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Transaksi yang dipilih akan dihapus permanen dari riwayat. Ringkasan, grafik, dan
              total kategori ikut menyesuaikan.
            </p>
            <div className="flex items-start gap-2 rounded-2xl bg-danger-soft px-3.5 py-3 text-[12.5px] font-medium text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>{selectedCount} transaksi akan dihapus dan tidak dapat dikembalikan.</p>
            </div>
          </DialogBody>
          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              onClick={handleDeleteSelected}
              disabled={deleting || selectedCount === 0}
              aria-busy={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Menghapus...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" aria-hidden /> Ya, hapus
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
