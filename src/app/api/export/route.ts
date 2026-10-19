import { requireApiUser } from "@/lib/api";
import { listAllTransactions } from "@/lib/data";
import { fromMinor } from "@/lib/money";

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Ekspor seluruh transaksi pengguna sebagai CSV atau JSON. */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";
  const transactions = listAllTransactions(auth.user.id);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const payload = {
      app: "Catatku",
      exportedAt: new Date().toISOString(),
      user: {
        name: auth.user.name,
        email: auth.user.email,
        currency: auth.user.currency,
      },
      transactions: transactions.map((tx) => ({
        type: tx.type,
        amount: fromMinor(tx.amount, auth.user.currency),
        currency: auth.user.currency,
        category: tx.category.name,
        note: tx.note,
        date: tx.date,
      })),
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="catatku-backup-${stamp}.json"`,
      },
    });
  }

  const header = ["tanggal", "jenis", "kategori", "catatan", "nominal", "mata_uang"];
  const lines = [
    header.join(","),
    ...transactions.map((tx) =>
      [
        tx.date,
        tx.type === "income" ? "masuk" : "keluar",
        csvEscape(tx.category.name),
        csvEscape(tx.note ?? ""),
        String(fromMinor(tx.amount, auth.user.currency)),
        auth.user.currency,
      ].join(","),
    ),
  ];

  // BOM agar terbaca rapi di Excel.
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="catatku-transaksi-${stamp}.csv"`,
    },
  });
}
