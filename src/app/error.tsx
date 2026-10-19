"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="app-canvas flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 text-center shadow-lg">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-4 text-[20px] font-bold tracking-tight">Ada yang tidak beres</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Halaman ini gagal dimuat. Coba lagi — kalau masih error, kembali ke beranda.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => reset()}>
            Coba lagi
          </Button>
          <Link href="/" className="flex-1">
            <Button className="w-full">Ke beranda</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
