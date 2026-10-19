import { z } from "zod";
import { ICON_OPTIONS } from "./constants";

const iconNames = ICON_OPTIONS.map((option) => option.name) as [string, ...string[]];

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime());
  }, "Tanggal tidak valid.");

const amountSchema = z
  .number({ error: "Nominal belum diisi." })
  .int("Nominal tidak valid.")
  .positive("Nominal harus lebih dari nol.")
  .max(1_000_000_000_000, "Nominal terlalu besar.");

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(60, "Nama terlalu panjang."),
  email: z.string().trim().toLowerCase().email("Email tidak valid."),
  password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter.")
    .max(72, "Kata sandi terlalu panjang."),
  currency: z.enum(["IDR", "USD", "EUR", "SGD", "MYR", "JPY", "GBP"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: amountSchema,
  categoryId: z.string().min(1, "Kategori wajib dipilih."),
  date: dateSchema,
  note: z
    .string()
    .trim()
    .max(200, "Catatan maksimal 200 karakter.")
    .optional()
    .nullable(),
});

export const transactionUpdateSchema = transactionSchema.partial().extend({
  id: z.string().optional(),
});

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kategori wajib diisi.")
    .max(30, "Nama kategori maksimal 30 karakter."),
  type: z.enum(["income", "expense"]),
  icon: z.enum(iconNames).catch("ellipsis"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Warna tidak valid.")
    .catch("#0F7B5A"),
});

export const categoryUpdateSchema = categorySchema.partial();

export const goalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama target wajib diisi.")
    .max(60, "Nama target maksimal 60 karakter."),
  targetAmount: amountSchema,
  savedAmount: z.number().int().min(0, "Jumlah terkumpul tidak boleh negatif.").optional(),
  deadline: dateSchema.optional().nullable(),
});

export const goalUpdateSchema = goalSchema.partial().extend({
  savedAmount: z.number().int().min(0).optional(),
});

export const budgetSchema = z.object({
  limitAmount: amountSchema,
  period: z.string().regex(/^\d{4}-\d{2}$/, "Periode tidak valid.").optional(),
  categoryId: z.string().optional().nullable(),
});

export const reminderSchema = z.object({
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam harus berformat HH:mm."),
  days: z
    .array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]))
    .min(1, "Pilih minimal satu hari."),
  isActive: z.boolean(),
  budgetAlertEnabled: z.boolean(),
});

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(60, "Nama terlalu panjang."),
  currency: z.enum(["IDR", "USD", "EUR", "SGD", "MYR", "JPY", "GBP"]),
});

export const themeSchema = z.object({
  theme: z.enum(["light", "dark"]),
});

export const importSchema = z.object({
  transactions: z.array(
    z.object({
      type: z.enum(["income", "expense"]),
      amount: z.number().int().positive(),
      category: z.string().optional(),
      note: z.string().optional().nullable(),
      date: dateSchema,
    }),
  ),
});

export type TransactionBody = z.infer<typeof transactionSchema>;
export type CategoryBody = z.infer<typeof categorySchema>;
export type GoalBody = z.infer<typeof goalSchema>;
export type ReminderBody = z.infer<typeof reminderSchema>;
