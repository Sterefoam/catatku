"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  MessageSquare,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { CategoryBadge } from "@/components/category-icon";
import { useApp } from "@/components/app/app-context";
import { apiDelete, apiErrorMessage, apiPatch, apiPost } from "@/lib/client-api";
import { todayISO } from "@/lib/date";
import type { TransactionDTO, TxType } from "@/lib/types";

interface TransactionSheetProps {
  editing: TransactionDTO | null;
  initialType: TxType;
}

export function TransactionSheet({ editing, initialType }: TransactionSheetProps) {
  const { categories, currency, closeQuickAdd, refresh } = useApp();

  const [type, setType] = React.useState<TxType>(editing?.type ?? initialType);
  const [amount, setAmount] = React.useState<number | null>(editing?.amount ?? null);
  const [categoryId, setCategoryId] = React.useState<string | null>(
    editing?.categoryId ??
      categories.find((category) => category.type === (editing?.type ?? initialType))?.id ??
      null,
  );
  const [date, setDate] = React.useState(editing?.date ?? todayISO());
  const [note, setNote] = React.useState(editing?.note ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const typeCategories = React.useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );

  function switchType(next: TxType) {
    setType(next);
    setError(null);
    const nextCategories = categories.filter((category) => category.type === next);
    setCategoryId((current) =>
      nextCategories.some((category) => category.id === current)
        ? current
        : (nextCategories[0]?.id ?? null),
    );
  }

  async function handleSubmit() {
    if (!amount || amount <= 0) {
      setError("Nominal belum diisi. Isi dulu nominalnya ya.");
      return;
    }
    if (!categoryId) {
      setError("Pilih kategori dulu sebelum menyimpan.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        type,
        amount,
        categoryId,
        date,
        note: note.trim() ? note.trim() : null,
      };
      if (editing) {
        await apiPatch(`/api/transactions/${editing.id}`, payload);
        toast.success("Perubahan transaksi tersimpan.");
      } else {
        await apiPost("/api/transactions", payload);
        toast.success(
          type === "income" ? "Pemasukan berhasil dicatat." : "Pengeluaran berhasil dicatat.",
        );
      }
      closeQuickAdd();
      refresh();
    } catch (submitError) {
      setError(apiErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/transactions/${editing.id}`);
      toast.success("Transaksi dihapus.");
      closeQuickAdd();
      refresh();
    } catch (deleteError) {
      toast.error(apiErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : closeQuickAdd())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah transaksi" : "Catat transaksi"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Perbaiki nominal, kategori, atau tanggalnya. Ringkasan ikut menyesuaikan."
              : "Cukup isi nominal dan kategori — selesai dalam hitungan detik."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <Segmented
            ariaLabel="Jenis transaksi"
            value={type}
            onChange={switchType}
            options={[
              {
                value: "expense",
                label: "Pengeluaran",
                tone: "expense",
                icon: <ArrowUpRight className="size-4" />,
              },
              {
                value: "income",
                label: "Pemasukan",
                tone: "income",
                icon: <ArrowDownLeft className="size-4" />,
              },
            ]}
          />

          <div className="rounded-3xl border border-border/70 bg-surface/60 p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Nominal
            </p>
            <AmountInput
              currency={currency}
              initialMinor={editing?.amount ?? null}
              onChange={(value) => {
                setAmount(value);
                if (value && value > 0) setError(null);
              }}
              invalid={Boolean(error && !amount)}
              autoFocus={!editing}
              onEnter={handleSubmit}
            />
            {error && !amount ? (
              <p className="mt-1 text-[12px] font-medium text-danger">{error}</p>
            ) : null}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold">Kategori</p>
              <Link
                href="/kategori"
                onClick={closeQuickAdd}
                className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-primary hover:underline"
              >
                <Plus className="size-3.5" /> Kelola
              </Link>
            </div>

            {typeCategories.length === 0 ? (
              <p className="rounded-2xl bg-muted px-4 py-3 text-[13px] text-muted-foreground">
                Belum ada kategori {type === "income" ? "pemasukan" : "pengeluaran"}. Tambahkan
                dulu di halaman Kategori.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {typeCategories.map((category) => {
                  const selected = category.id === categoryId;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategoryId(category.id)}
                      aria-pressed={selected}
                      className={
                        selected
                          ? "flex flex-col items-center gap-1.5 rounded-2xl bg-primary-soft/80 px-1 py-2.5 ring-2 ring-primary/60 transition-all"
                          : "flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-all hover:bg-muted"
                      }
                    >
                      <CategoryBadge icon={category.icon} color={category.color} size="sm" />
                      <span className="w-full truncate text-center text-[11px] font-medium leading-tight">
                        {category.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="transaction-date"
                className="text-[13px] font-semibold text-muted-foreground"
              >
                Tanggal
              </label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="transaction-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value || todayISO())}
                  className="h-11 w-full rounded-2xl border border-border bg-card pl-10 pr-3 text-[14px] outline-none focus-visible:border-primary/60"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="transaction-note"
                className="text-[13px] font-semibold text-muted-foreground"
              >
                Catatan <span className="font-normal">(opsional)</span>
              </label>
              <div className="relative">
                <MessageSquare className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="transaction-note"
                  type="text"
                  maxLength={200}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="mis. Makan siang"
                  className="h-11 w-full rounded-2xl border border-border bg-card pl-10 pr-3 text-[14px] outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary/60"
                />
              </div>
            </div>
          </div>

          {editing ? (
            <div className="border-t border-border/70 pt-3">
              {confirmDelete ? (
                <div className="space-y-2.5 rounded-2xl bg-danger-soft/60 p-3.5">
                  <p className="flex items-start gap-2 text-[13px] font-medium text-danger">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    Hapus transaksi ini? Tindakan ini tidak bisa dibatalkan.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                    >
                      Batal
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="flex-1"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Menghapus..." : "Ya, hapus"}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-danger transition-opacity hover:opacity-80"
                >
                  <Trash2 className="size-4" /> Hapus transaksi
                </button>
              )}
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter>
          {error && amount ? (
            <p className="mb-2 text-[12px] font-medium text-danger">{error}</p>
          ) : null}
          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={saving || deleting || typeCategories.length === 0}
          >
            {saving
              ? "Menyimpan..."
              : editing
                ? "Simpan perubahan"
                : `Simpan ${type === "income" ? "pemasukan" : "pengeluaran"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
