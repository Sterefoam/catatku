"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app/app-context";
import type { TxType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Tombol catat cepat yang bisa dipakai di halaman mana pun. */
export function QuickAddButton({
  type = "expense",
  label = "Catat transaksi",
  variant = "primary",
  size = "md",
  className,
}: {
  type?: TxType;
  label?: string;
  variant?: "primary" | "soft" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { openCreate } = useApp();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => openCreate(type)}
    >
      <Plus className="size-4" />
      {label}
    </Button>
  );
}

/** Tombol bulat besar (FAB) untuk catat cepat. */
export function QuickAddFab({ className }: { className?: string }) {
  const { openCreate } = useApp();
  return (
    <button
      type="button"
      onClick={() => openCreate("expense")}
      aria-label="Catat transaksi baru"
      className={cn(
        "flex size-14 items-center justify-center rounded-full bg-[linear-gradient(140deg,#129168_0%,#0b6a4d_58%,#0a4a37_100%)] text-white shadow-[0_14px_28px_-10px_rgba(10,85,60,0.85)] ring-4 ring-background transition-transform active:scale-95",
        className,
      )}
    >
      <Plus className="size-6" strokeWidth={2.4} />
    </button>
  );
}
