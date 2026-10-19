import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Tidak ada koneksi" };

export default function OfflinePage() {
  return (
    <div className="app-canvas flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 text-center shadow-lg">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-warning-soft text-warning">
          <WifiOff className="size-6" />
        </span>
        <h1 className="mt-4 text-[20px] font-bold tracking-tight">Kamu sedang offline</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Catatku butuh koneksi untuk menyimpan transaksi. Sambungkan internet lagi, lalu coba
          muat ulang halaman ini.
        </p>
        <Link href="/" className={`${buttonVariants()} mt-5 w-full`}>
          Coba lagi
        </Link>
      </div>
    </div>
  );
}
