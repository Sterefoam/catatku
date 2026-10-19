"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Lock,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { CategoryBadge, CategoryIcon } from "@/components/category-icon";
import { ApiClientError, apiDelete, apiErrorMessage, apiPatch, apiPost } from "@/lib/client-api";
import { COLOR_OPTIONS, ICON_OPTIONS } from "@/lib/constants";
import type { CategoryDTO, TxType } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_NAME = 30;

const TYPE_META: Record<TxType, { label: string; icon: string; color: string }> = {
  expense: { label: "Pengeluaran", icon: "utensils", color: "#F97316" },
  income: { label: "Pemasukan", icon: "briefcase", color: "#16A34A" },
};

/** Warna centang pada swatch supaya tetap terbaca di warna terang maupun gelap. */
function contrastText(hex: string): string {
  const value = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return "#ffffff";
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#10201a" : "#ffffff";
}

interface CategoryFormDialogProps {
  category: CategoryDTO | null;
  initialType: TxType;
  onClose: () => void;
  /** Dipanggil setelah mutasi sukses: tutup dialog + refresh data server. */
  onCommitted: () => void;
}

export function CategoryFormDialog({
  category,
  initialType,
  onClose,
  onCommitted,
}: CategoryFormDialogProps) {
  const editing = Boolean(category);
  const startType = category?.type ?? initialType;
  const initialColor = category?.color ?? TYPE_META[startType].color;

  const [name, setName] = React.useState(category?.name ?? "");
  const [type, setType] = React.useState<TxType>(startType);
  const [icon, setIcon] = React.useState(category?.icon ?? TYPE_META[startType].icon);
  const [color, setColor] = React.useState(initialColor);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [iconError, setIconError] = React.useState<string | null>(null);
  const [colorError, setColorError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const usage = category?.transactionCount ?? 0;
  const selectedIconLabel =
    ICON_OPTIONS.find((option) => option.name === icon)?.label ?? "Ikon khusus";

  /** Warna lama buatan pengguna tetap ditampilkan walau tidak ada di palet. */
  const colorPalette = React.useMemo(() => {
    const palette: string[] = [...COLOR_OPTIONS];
    if (!palette.includes(initialColor)) palette.unshift(initialColor);
    return palette;
  }, [initialColor]);

  function handleTypeChange(next: TxType) {
    if (editing || next === type) return;
    setType(next);
    setIcon(TYPE_META[next].icon);
    setColor(TYPE_META[next].color);
    setFormError(null);
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Nama kategori wajib diisi.");
      return;
    }
    if (trimmed.length > MAX_NAME) {
      setNameError(`Nama kategori maksimal ${MAX_NAME} karakter.`);
      return;
    }
    if (!ICON_OPTIONS.some((option) => option.name === icon)) {
      setIconError("Pilih ikon dari daftar yang tersedia.");
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      setColorError("Pilih warna dari daftar yang tersedia.");
      return;
    }

    setSaving(true);
    setNameError(null);
    setIconError(null);
    setColorError(null);
    setFormError(null);

    try {
      if (category) {
        await apiPatch(`/api/categories/${category.id}`, { name: trimmed, icon, color });
        toast.success("Kategori diperbarui.");
      } else {
        await apiPost("/api/categories", { name: trimmed, type, icon, color });
        toast.success("Kategori baru ditambahkan.");
      }
      onCommitted();
    } catch (error) {
      const details = error instanceof ApiClientError ? error.details : undefined;
      let hasFieldError = false;
      if (details?.name) {
        setNameError(details.name);
        hasFieldError = true;
      }
      if (details?.icon) {
        setIconError(details.icon);
        hasFieldError = true;
      }
      if (details?.color) {
        setColorError(details.color);
        hasFieldError = true;
      }
      if (!hasFieldError) setFormError(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!category) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiDelete(`/api/categories/${category.id}`);
      toast.success("Kategori dihapus.");
      onCommitted();
    } catch (error) {
      setDeleteError(apiErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving && !deleting) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah kategori" : "Tambah kategori"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Perbarui nama, ikon, atau warnanya. Perubahan langsung terlihat saat mencatat transaksi."
              : "Beri nama yang mudah diingat, lalu pilih ikon dan warna pembedanya."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface/60 p-3.5">
            <CategoryBadge icon={icon} color={color} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">
                {name.trim() || "Nama kategori"}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                Pratinjau kategori {TYPE_META[type].label.toLowerCase()}
              </p>
            </div>
          </div>

          {editing ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/50 px-3.5 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                  <Lock className="size-3.5" /> Jenis kategori
                </span>
                <Badge tone={type === "income" ? "success" : "danger"}>
                  {TYPE_META[type].label}
                </Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Jenis kategori dikunci saat mengubah. Hapus lalu buat ulang bila ingin jenis
                berbeda.
              </p>
            </div>
          ) : (
            <Segmented
              ariaLabel="Jenis kategori"
              value={type}
              onChange={handleTypeChange}
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
          )}

          <Field
            label="Nama kategori"
            htmlFor="category-name"
            error={nameError}
            hint={`${name.trim().length}/${MAX_NAME} karakter`}
          >
            <Input
              id="category-name"
              value={name}
              maxLength={MAX_NAME}
              autoComplete="off"
              autoFocus={!editing}
              aria-invalid={Boolean(nameError)}
              placeholder={type === "income" ? "mis. Freelance" : "mis. Kopi pagi"}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
                setFormError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !confirmDelete) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </Field>

          <Field
            label="Ikon"
            error={iconError}
            hint={`${ICON_OPTIONS.length} ikon tersedia · dipilih: ${selectedIconLabel}`}
          >
            <div
              role="group"
              aria-label="Pilih ikon kategori"
              className="grid grid-cols-6 gap-2"
            >
              {ICON_OPTIONS.map((option) => {
                const active = option.name === icon;
                return (
                  <button
                    key={option.name}
                    type="button"
                    title={option.label}
                    aria-label={option.label}
                    aria-pressed={active}
                    onClick={() => {
                      setIcon(option.name);
                      setIconError(null);
                      setFormError(null);
                    }}
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-xl border transition-all duration-150",
                      active
                        ? "border-primary bg-primary-soft text-primary ring-2 ring-primary/40"
                        : "border-border/70 bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <CategoryIcon name={option.name} />
                  </button>
                );
              })}
            </div>
          </Field>

          <Field
            label="Warna"
            error={colorError}
            hint="Warna ini dipakai pada ikon di daftar transaksi dan ringkasan."
          >
            <div
              role="group"
              aria-label="Pilih warna kategori"
              className="grid grid-cols-6 gap-2 sm:grid-cols-9"
            >
              {colorPalette.map((option) => {
                const active = option.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={option}
                    type="button"
                    title={option}
                    aria-label={`Pilih warna ${option}`}
                    aria-pressed={active}
                    onClick={() => {
                      setColor(option);
                      setColorError(null);
                      setFormError(null);
                    }}
                    className="inline-flex size-10 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 active:scale-95"
                    style={{
                      backgroundColor: option,
                      boxShadow: active
                        ? `0 0 0 2px var(--card), 0 0 0 4px ${option}`
                        : "inset 0 0 0 1px rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    {active ? (
                      <Check className="size-4" style={{ color: contrastText(option) }} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Field>

          {formError ? (
            <p
              role="alert"
              className="rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed text-danger"
            >
              {formError}
            </p>
          ) : null}

          {editing ? (
            <div className="border-t border-border/70 pt-3">
              {confirmDelete ? (
                usage > 0 || deleteError ? (
                  <div
                    className={cn(
                      "space-y-2.5 rounded-2xl p-3.5",
                      deleteError ? "bg-danger-soft/60" : "bg-warning-soft/70",
                    )}
                  >
                    <p
                      className={cn(
                        "flex items-start gap-2 text-[13px] font-semibold",
                        deleteError ? "text-danger" : "text-warning",
                      )}
                    >
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                      {deleteError
                        ? deleteError
                        : `Kategori ini masih dipakai oleh ${usage} transaksi.`}
                    </p>
                    <p className="pl-6 text-[12px] leading-relaxed text-muted-foreground">
                      {usage > 0
                        ? "Pindahkan atau hapus transaksi tersebut dulu, lalu kembali ke sini untuk menghapus kategori. Riwayatmu tetap aman."
                        : "Kategori belum terhapus. Coba lagi sebentar lagi."}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={deleting}
                      onClick={() => {
                        setConfirmDelete(false);
                        setDeleteError(null);
                      }}
                    >
                      {deleting ? "Menghapus..." : "Mengerti"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5 rounded-2xl bg-danger-soft/60 p-3.5">
                    <p className="flex items-start gap-2 text-[13px] font-medium text-danger">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                      Hapus kategori &quot;{category?.name}&quot;? Tindakan ini tidak bisa
                      dibatalkan.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={deleting}
                        onClick={() => setConfirmDelete(false)}
                      >
                        Batal
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="flex-1"
                        disabled={deleting}
                        onClick={() => void handleDelete()}
                      >
                        {deleting ? "Menghapus..." : "Ya, hapus"}
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-danger transition-opacity hover:opacity-80"
                >
                  <Trash2 className="size-4" /> Hapus kategori
                </button>
              )}
              {category?.isDefault ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Kategori bawaan boleh diubah atau dihapus kapan saja.
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            size="lg"
            className="w-full"
            onClick={() => void handleSubmit()}
            disabled={saving || deleting}
          >
            {saving
              ? "Menyimpan..."
              : editing
                ? "Simpan perubahan"
                : "Tambah kategori"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
