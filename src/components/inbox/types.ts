import type { CategoryDTO, TxType } from "@/lib/types";

/**
 * Tipe data Kotak Masuk. Semua bentuk di sini serializable supaya aman
 * dikirim dari server component (/inbox) ke client component.
 */

export type InboxSource = "email" | "statement";
export type InboxConfidence = "high" | "low";

/** Transaksi tertunda yang menunggu konfirmasi kategori & validitasnya. */
export interface InboxItem {
  id: string;
  source: InboxSource;
  type: TxType;
  /** Nominal dalam satuan terkecil (Rupiah = rupiah). */
  amount: number;
  /** Tanggal transaksi "YYYY-MM-DD". */
  date: string;
  note: string | null;
  rawSubject: string | null;
  createdAt: string;
  confidence: InboxConfidence | null;
}

/** Kategori bawaan untuk sebuah item: kategori pertama dengan jenis yang sama. */
export function defaultCategoryFor(item: InboxItem, categories: CategoryDTO[]): string {
  return categories.find((category) => category.type === item.type)?.id ?? "";
}

/** Label sumber transaksi untuk badge. */
export function sourceLabel(source: InboxSource): string {
  return source === "email" ? "Email BCA" : "Mutasi";
}

/** Judul kartu: nama merchant/catatan, atau deskripsi sumber bila kosong. */
export function itemTitle(item: InboxItem): string {
  const note = item.note?.trim();
  if (note) return note;
  return item.source === "email" ? "Notifikasi email BCA" : "Mutasi rekening";
}
