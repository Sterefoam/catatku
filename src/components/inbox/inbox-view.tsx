"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Inbox as InboxIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { apiErrorMessage, apiPost } from "@/lib/client-api";
import type { CategoryDTO, TransactionDTO } from "@/lib/types";
import { ImportStatementCard } from "./import-statement-card";
import { InboxItemCard, type InboxBusyAction } from "./inbox-item-card";
import { defaultCategoryFor, itemTitle, type InboxItem } from "./types";

interface BulkProgress {
  done: number;
  total: number;
}

function buildSelection(
  items: InboxItem[],
  categories: CategoryDTO[],
): Record<string, string> {
  const selection: Record<string, string> = {};
  for (const item of items) selection[item.id] = defaultCategoryFor(item, categories);
  return selection;
}

function sortNewestFirst(a: InboxItem, b: InboxItem): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

/**
 * Tampilan Kotak Masuk: daftar transaksi tertunda dari email BCA/impor mutasi,
 * pemilih kategori per item, konfirmasi/abaikan, dan seksi impor CSV.
 */
export function InboxView({
  items: serverItems,
  categories,
  currency,
  today,
}: {
  items: InboxItem[];
  categories: CategoryDTO[];
  currency: string;
  today: string;
}) {
  const router = useRouter();

  const [items, setItems] = React.useState<InboxItem[]>(serverItems);
  const [selection, setSelection] = React.useState<Record<string, string>>(() =>
    buildSelection(serverItems, categories),
  );
  const [busy, setBusy] = React.useState<{ id: string; action: Exclude<InboxBusyAction, null> } | null>(
    null,
  );
  const [bulk, setBulk] = React.useState<BulkProgress | null>(null);

  // Data server terbaru (setelah router.refresh) menggantikan daftar lokal.
  React.useEffect(() => {
    setItems(serverItems);
  }, [serverItems]);

  // Pastikan setiap item punya kategori terpilih yang masih valid.
  React.useEffect(() => {
    setSelection((previous) => {
      const validIds = new Set(categories.map((category) => category.id));
      let changed = false;
      const next = { ...previous };
      for (const item of serverItems) {
        const current = next[item.id];
        if (current !== undefined && validIds.has(current)) continue;
        const fallback = defaultCategoryFor(item, categories);
        if (current !== fallback) changed = true;
        next[item.id] = fallback;
      }
      return changed ? next : previous;
    });
  }, [serverItems, categories]);

  const ordered = React.useMemo(() => [...items].sort(sortNewestFirst), [items]);

  const incomeCount = React.useMemo(
    () => items.filter((item) => item.type === "income").length,
    [items],
  );
  const expenseCount = items.length - incomeCount;

  const isBusy = busy !== null;
  const bulkRunning = bulk !== null;
  const bulkPercent = bulk && bulk.total > 0 ? Math.round((bulk.done / bulk.total) * 100) : 0;

  function categoryIdFor(item: InboxItem): string {
    return selection[item.id] ?? defaultCategoryFor(item, categories);
  }

  function handleSelectCategory(itemId: string, categoryId: string) {
    setSelection((previous) => ({ ...previous, [itemId]: categoryId }));
  }

  async function handleConfirm(item: InboxItem) {
    const categoryId = categoryIdFor(item);
    if (!categoryId) {
      toast.error("Pilih kategori dulu sebelum konfirmasi.");
      return;
    }

    setBusy({ id: item.id, action: "confirm" });
    try {
      await apiPost<{ transaction: TransactionDTO }>(
        `/api/inbox/${encodeURIComponent(item.id)}/confirm`,
        { categoryId },
      );
      // Hilangkan dari daftar lebih dulu supaya terasa instan; refresh
      // menyelaraskan ulang dengan data server.
      setItems((previous) => previous.filter((entry) => entry.id !== item.id));
      toast.success("Transaksi dicatat.", { description: itemTitle(item) });
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error) || "Gagal mengonfirmasi transaksi. Coba lagi.");
    } finally {
      setBusy(null);
    }
  }

  async function handleIgnore(item: InboxItem) {
    setBusy({ id: item.id, action: "ignore" });
    try {
      await apiPost<{ ok: true }>(`/api/inbox/${encodeURIComponent(item.id)}/ignore`, {});
      setItems((previous) => previous.filter((entry) => entry.id !== item.id));
      toast("Transaksi diabaikan.", { description: itemTitle(item) });
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error) || "Gagal mengabaikan transaksi. Coba lagi.");
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirmAll() {
    const snapshot = items;
    if (snapshot.length === 0 || bulkRunning) return;

    setBulk({ done: 0, total: snapshot.length });
    const succeeded: string[] = [];
    let failed = 0;

    for (const [index, item] of snapshot.entries()) {
      const categoryId = categoryIdFor(item);
      if (categoryId) {
        try {
          await apiPost<{ transaction: TransactionDTO }>(
            `/api/inbox/${encodeURIComponent(item.id)}/confirm`,
            { categoryId },
          );
          succeeded.push(item.id);
        } catch {
          failed += 1;
        }
      } else {
        failed += 1;
      }
      setBulk({ done: index + 1, total: snapshot.length });
    }

    if (succeeded.length > 0) {
      setItems((previous) => previous.filter((entry) => !succeeded.includes(entry.id)));
    }

    if (failed === 0) {
      toast.success(`${succeeded.length} transaksi berhasil dicatat.`);
    } else if (succeeded.length === 0) {
      toast.error(`${failed} transaksi gagal dicatat. Coba lagi satu per satu.`);
    } else {
      toast.warning(`${succeeded.length} transaksi dicatat.`, {
        description: `${failed} transaksi gagal — periksa sisanya lalu coba lagi.`,
      });
    }

    setBulk(null);
    router.refresh();
  }

  function handleImported() {
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {items.length === 0 ? (
        <EmptyState
          icon={<InboxIcon className="size-6" aria-hidden="true" />}
          title="Tidak ada transaksi menunggu"
          description="Transaksi otomatis dari email BCA atau impor mutasi akan muncul di sini untuk kamu periksa dan konfirmasi sebelum dicatat."
        />
      ) : (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <InboxIcon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug">
                  {items.length} transaksi menunggu konfirmasi
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                  {incomeCount} pemasukan · {expenseCount} pengeluaran — periksa kategori lalu
                  konfirmasi.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleConfirmAll}
                disabled={bulkRunning}
                aria-busy={bulkRunning || undefined}
                aria-label="Konfirmasi semua transaksi memakai kategori bawaan"
                className="h-10 shrink-0 px-3.5"
              >
                {bulkRunning ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCheck className="size-4" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">
                  {bulkRunning ? "Mencatat…" : "Konfirmasi semua"}
                </span>
                <span className="sm:hidden">
                  {bulkRunning ? `${bulk.done}/${bulk.total}` : "Semua"}
                </span>
              </Button>
            </div>

            {bulkRunning ? (
              <div className="px-4 pb-3.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${bulkPercent}%` }}
                  />
                </div>
                <p
                  className="mt-1.5 text-[11px] text-muted-foreground"
                  aria-live="polite"
                >
                  Mencatat {bulk.done} dari {bulk.total} transaksi…
                </p>
              </div>
            ) : null}
          </Card>

          <section aria-label="Transaksi menunggu konfirmasi" className="space-y-3">
            {ordered.map((item) => (
              <InboxItemCard
                key={item.id}
                item={item}
                categories={categories}
                currency={currency}
                today={today}
                selectedCategoryId={selection[item.id] ?? ""}
                busyAction={busy?.id === item.id ? busy.action : null}
                disabled={isBusy || bulkRunning}
                onSelectCategory={handleSelectCategory}
                onConfirm={handleConfirm}
                onIgnore={handleIgnore}
              />
            ))}
          </section>
        </div>
      )}

      <ImportStatementCard onImported={handleImported} />
    </div>
  );
}
