import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { addDaysToISO, todayISO } from "../date";
import { hashPassword } from "../password";
import type { DatabaseClient } from "./index";
import { budgets, categories, goals, reminders, transactions, users } from "./schema";
import { seedDefaultCategories } from "./seed-defaults";

export const DEMO_EMAIL = "demo@catatku.id";
export const DEMO_PASSWORD = "demo12345";

/** PRNG deterministik supaya data demo selalu sama. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

interface DemoExpenseTemplate {
  category: string;
  notes: string[];
  min: number;
  max: number;
  weight: number;
}

const EXPENSE_TEMPLATES: DemoExpenseTemplate[] = [
  {
    category: "Makan",
    notes: ["Makan siang", "Sarapan", "Kopi sore", "Makan malam", "Jajan"],
    min: 15_000,
    max: 75_000,
    weight: 6,
  },
  {
    category: "Transportasi",
    notes: ["Bensin", "Ojek online", "Parkir", "Angkutan umum"],
    min: 8_000,
    max: 55_000,
    weight: 4,
  },
  {
    category: "Belanja",
    notes: ["Belanja mingguan", "Kebutuhan rumah", "Sabun & sampo"],
    min: 45_000,
    max: 320_000,
    weight: 2,
  },
  {
    category: "Hiburan",
    notes: ["Nonton film", "Langganan musik", "Main bareng teman"],
    min: 35_000,
    max: 180_000,
    weight: 1,
  },
  {
    category: "Kesehatan",
    notes: ["Vitamin", "Obat batuk"],
    min: 25_000,
    max: 150_000,
    weight: 1,
  },
  {
    category: "Pendidikan",
    notes: ["Buku", "Kursus online"],
    min: 50_000,
    max: 250_000,
    weight: 1,
  },
];

export async function seedDemoData(
  db: DatabaseClient,
): Promise<{ userId: string; created: boolean }> {
  const existing = await db.select().from(users);
  const found = existing.find((row) => row.email === DEMO_EMAIL);
  if (found) {
    return { userId: found.id, created: false };
  }

  const userId = randomUUID();
  const now = new Date().toISOString();

  await db.insert(users).values({
    id: userId,
    name: "Rina Pratama",
    email: DEMO_EMAIL,
    passwordHash: hashPassword(DEMO_PASSWORD),
    currency: "IDR",
    theme: "light",
    createdAt: now,
  });

  await seedDefaultCategories(db, userId);

  const categoryRows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));
  const categoryId = (name: string): string => {
    const row = categoryRows.find((candidate) => candidate.name === name);
    if (!row) throw new Error(`Kategori demo tidak ditemukan: ${name}`);
    return row.id;
  };

  const random = createRandom(20261019);
  const today = todayISO();
  const rows: (typeof transactions.$inferInsert)[] = [];

  const push = (input: {
    type: "income" | "expense";
    categoryName: string;
    amount: number;
    date: string;
    note: string;
  }) => {
    rows.push({
      id: randomUUID(),
      userId,
      categoryId: categoryId(input.categoryName),
      type: input.type,
      amount: input.amount,
      note: input.note,
      date: input.date,
      createdAt: `${input.date}T${String(9 + (rows.length % 10)).padStart(2, "0")}:15:00.000Z`,
      updatedAt: `${input.date}T${String(9 + (rows.length % 10)).padStart(2, "0")}:15:00.000Z`,
    });
  };

  for (let offset = 74; offset >= 0; offset -= 1) {
    const day = addDaysToISO(today, -offset);
    const date = new Date(`${day}T00:00:00Z`);
    const dayOfMonth = date.getUTCDate();

    // Gaji bulanan.
    if (dayOfMonth === 25) {
      push({
        type: "income",
        categoryName: "Gaji",
        amount: 8_750_000,
        date: day,
        note: "Gaji bulanan",
      });
    }

    // Bonus / komisi sesekali.
    if (dayOfMonth === 10 && random() > 0.45) {
      push({
        type: "income",
        categoryName: "Bonus",
        amount: 750_000 + Math.round(random() * 8) * 125_000,
        date: day,
        note: "Bonus proyek",
      });
    }

    // Tagihan tetap tiap awal bulan.
    if (dayOfMonth === 2) {
      push({
        type: "expense",
        categoryName: "Tagihan",
        amount: 385_000,
        date: day,
        note: "Listrik & air",
      });
      push({
        type: "expense",
        categoryName: "Tagihan",
        amount: 349_000,
        date: day,
        note: "Internet rumah",
      });
    }

    // Pengeluaran harian (kadang libur).
    if (random() < 0.78) {
      const templatePool: DemoExpenseTemplate[] = [];
      for (const template of EXPENSE_TEMPLATES) {
        for (let index = 0; index < template.weight; index += 1) {
          templatePool.push(template);
        }
      }
      const template = templatePool[Math.floor(random() * templatePool.length)]!;
      const spread = template.max - template.min;
      const amount = Math.round((template.min + random() * spread) / 500) * 500;
      push({
        type: "expense",
        categoryName: template.category,
        amount,
        date: day,
        note: template.notes[Math.floor(random() * template.notes.length)]!,
      });

      // Sesekali dua transaksi dalam sehari.
      if (random() < 0.3) {
        const second = EXPENSE_TEMPLATES[Math.floor(random() * EXPENSE_TEMPLATES.length)]!;
        push({
          type: "expense",
          categoryName: second.category,
          amount:
            Math.round(
              (second.min + random() * (second.max - second.min)) / 500,
            ) * 500,
          date: day,
          note: second.notes[Math.floor(random() * second.notes.length)]!,
        });
      }
    }
  }

  // Insert per batch agar tidak melebihi batas parameter SQL.
  for (let index = 0; index < rows.length; index += 40) {
    await db.insert(transactions).values(rows.slice(index, index + 40));
  }

  await db.insert(goals).values([
    {
      id: randomUUID(),
      userId,
      name: "Dana Darurat",
      targetAmount: 20_000_000,
      savedAmount: 7_500_000,
      deadline: addDaysToISO(today, 180),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      userId,
      name: "Liburan ke Bali",
      targetAmount: 8_000_000,
      savedAmount: 3_200_000,
      deadline: addDaysToISO(today, 95),
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(budgets).values({
    id: randomUUID(),
    userId,
    categoryId: null,
    limitAmount: 4_500_000,
    period: today.slice(0, 7),
    createdAt: now,
  });

  await db.insert(reminders).values({
    id: randomUUID(),
    userId,
    time: "20:00",
    days: "mon,tue,wed,thu,fri,sat,sun",
    isActive: true,
    budgetAlertEnabled: true,
    createdAt: now,
    updatedAt: now,
  });

  return { userId, created: true };
}
