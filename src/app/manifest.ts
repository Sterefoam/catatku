import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Pencatat Uang Pribadi`,
    short_name: APP_NAME,
    description:
      "Catat pemasukan dan pengeluaran, pantau sisa uang, arus kas, target tabungan, dan pengingat harian.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f3",
    theme_color: "#0e7a56",
    lang: "id",
    categories: ["finance", "productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Catat pengeluaran",
        short_name: "Pengeluaran",
        description: "Langsung mencatat pengeluaran baru",
        url: "/catat?type=expense",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Riwayat transaksi",
        short_name: "Riwayat",
        description: "Lihat semua catatan transaksi",
        url: "/riwayat",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
