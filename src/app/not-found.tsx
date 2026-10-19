import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="app-canvas flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary-soft text-primary">
          <Compass className="size-7" />
        </span>
        <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-primary">
          404
        </p>
        <h1 className="mt-1 text-[22px] font-bold tracking-tight">Halaman tidak ditemukan</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Tautan yang kamu buka mungkin sudah dipindahkan atau salah ketik.
        </p>
        <Link href="/" className="mt-5 inline-block">
          <Button>Kembali ke beranda</Button>
        </Link>
      </div>
    </div>
  );
}
