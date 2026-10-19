import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "./index";
import { categories } from "./schema";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../constants";

/**
 * Menanam kategori bawaan untuk pengguna baru, supaya ia bisa langsung
 * mencatat transaksi pertama tanpa mengatur apa pun.
 */
export function seedDefaultCategories(db: DatabaseClient, userId: string): void {
  const now = new Date().toISOString();
  const rows = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((category) => ({
      id: randomUUID(),
      userId,
      name: category.name,
      type: "expense" as const,
      icon: category.icon,
      color: category.color,
      isDefault: true,
      createdAt: now,
    })),
    ...DEFAULT_INCOME_CATEGORIES.map((category) => ({
      id: randomUUID(),
      userId,
      name: category.name,
      type: "income" as const,
      icon: category.icon,
      color: category.color,
      isDefault: true,
      createdAt: now,
    })),
  ];

  db.insert(categories).values(rows).run();
}
