"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** Tombol ganti mode terang/gelap, tersimpan di perangkat & akun. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  async function toggle() {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      await fetch("/api/settings/theme", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
    } catch {
      // preferensi lokal tetap tersimpan lewat next-themes
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Ganti mode terang atau gelap"
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="size-[18px]" />
      ) : (
        <Moon className="size-[18px]" />
      )}
    </button>
  );
}
