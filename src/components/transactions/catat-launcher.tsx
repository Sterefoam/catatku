"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApp } from "@/components/app/app-context";

/**
 * Halaman /catat dipakai sebagai tautan notifikasi.
 * Sheet catat cepat dibuka otomatis, dengan tombol cadangan bila ditutup.
 */
export function CatatLauncher() {
  const { openCreate } = useApp();

  React.useEffect(() => {
    const timer = window.setTimeout(() => openCreate("expense"), 200);
    return () => window.clearTimeout(timer);
  }, [openCreate]);

  return (
    <Card className="p-6 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <ReceiptText className="size-6" />
      </span>
      <h2 className="mt-3 text-[18px] font-bold tracking-tight">Catat transaksi</h2>
      <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
        Formulir catat cepat terbuka otomatis. Kalau tertutup, pilih jenis transaksi di bawah
        ini.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={() => openCreate("expense")} variant="soft">
          <ArrowUpRight className="size-4" /> Pengeluaran
        </Button>
        <Button onClick={() => openCreate("income")} variant="outline">
          <ArrowDownLeft className="size-4" /> Pemasukan
        </Button>
      </div>
    </Card>
  );
}
