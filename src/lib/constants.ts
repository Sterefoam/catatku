import type { CurrencyCode } from "./money";

/** Daftar ikon yang boleh dipakai kategori (nama = ikon Lucide, kebab-case). */
export const ICON_OPTIONS = [
  { name: "utensils", label: "Makan & Minum" },
  { name: "coffee", label: "Kopi" },
  { name: "shopping-bag", label: "Belanja" },
  { name: "shopping-cart", label: "Belanja Harian" },
  { name: "car", label: "Mobil" },
  { name: "bus", label: "Transportasi Umum" },
  { name: "fuel", label: "Bensin" },
  { name: "bike", label: "Motor / Sepeda" },
  { name: "plane", label: "Perjalanan" },
  { name: "receipt", label: "Tagihan" },
  { name: "wifi", label: "Internet" },
  { name: "phone", label: "Pulsa & Telepon" },
  { name: "zap", label: "Listrik" },
  { name: "droplets", label: "Air" },
  { name: "home", label: "Rumah & Sewa" },
  { name: "heart-pulse", label: "Kesehatan" },
  { name: "dumbbell", label: "Olahraga" },
  { name: "graduation-cap", label: "Pendidikan" },
  { name: "book-open", label: "Buku" },
  { name: "gamepad-2", label: "Hiburan" },
  { name: "shirt", label: "Pakaian" },
  { name: "sparkles", label: "Perawatan" },
  { name: "paw-print", label: "Hewan Peliharaan" },
  { name: "baby", label: "Anak" },
  { name: "gift", label: "Hadiah" },
  { name: "wallet", label: "Dompet" },
  { name: "briefcase", label: "Pekerjaan" },
  { name: "trending-up", label: "Investasi" },
  { name: "landmark", label: "Bank" },
  { name: "piggy-bank", label: "Tabungan" },
  { name: "plus-circle", label: "Lainnya" },
  { name: "ellipsis", label: "Lain-lain" },
] as const;

export type CategoryIcon = (typeof ICON_OPTIONS)[number]["name"];

/** Palet warna kategori — cukup kontras di mode terang maupun gelap. */
export const COLOR_OPTIONS = [
  "#0F7B5A",
  "#16A34A",
  "#0EA5A5",
  "#0284C7",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#EAB308",
  "#84CC16",
  "#14B8A6",
  "#64748B",
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Makan", icon: "utensils", color: "#F97316" },
  { name: "Transportasi", icon: "car", color: "#3B82F6" },
  { name: "Tagihan", icon: "receipt", color: "#8B5CF6" },
  { name: "Belanja", icon: "shopping-bag", color: "#EC4899" },
  { name: "Hiburan", icon: "gamepad-2", color: "#06B6D4" },
  { name: "Kesehatan", icon: "heart-pulse", color: "#EF4444" },
  { name: "Pendidikan", icon: "graduation-cap", color: "#14B8A6" },
  { name: "Lainnya", icon: "ellipsis", color: "#64748B" },
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  { name: "Gaji", icon: "briefcase", color: "#16A34A" },
  { name: "Bonus", icon: "gift", color: "#84CC16" },
  { name: "Investasi", icon: "trending-up", color: "#0EA5A5" },
  { name: "Lainnya", icon: "plus-circle", color: "#64748B" },
] as const;

export const CURRENCY_LIST: { code: CurrencyCode; label: string }[] = [
  { code: "IDR", label: "Rupiah Indonesia" },
  { code: "USD", label: "Dolar Amerika Serikat" },
  { code: "EUR", label: "Euro" },
  { code: "SGD", label: "Dolar Singapura" },
  { code: "MYR", label: "Ringgit Malaysia" },
  { code: "JPY", label: "Yen Jepang" },
  { code: "GBP", label: "Pound Inggris" },
];

export const WEEKDAYS = [
  { key: "mon", label: "Sen", full: "Senin" },
  { key: "tue", label: "Sel", full: "Selasa" },
  { key: "wed", label: "Rab", full: "Rabu" },
  { key: "thu", label: "Kam", full: "Kamis" },
  { key: "fri", label: "Jum", full: "Jumat" },
  { key: "sat", label: "Sab", full: "Sabtu" },
  { key: "sun", label: "Min", full: "Minggu" },
] as const;

export const APP_NAME = "Catatku";
export const APP_TAGLINE = "Uang rapi, hati tenang.";
