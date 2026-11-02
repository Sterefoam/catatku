"use client";

/**
 * Tombol "Simpan ke daftar pantau" untuk halaman Inspeksi Saham.
 * Mutasi lewat API + toast + router.refresh().
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiPost } from "@/lib/client-api";
import { cn } from "@/lib/utils";

export function WatchlistButton({
  symbol,
  name,
  inWatchlist,
  className,
}: {
  symbol: string;
  name?: string;
  inWatchlist: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [added, setAdded] = React.useState(inWatchlist);
  const [pending, setPending] = React.useState(false);

  async function addToWatchlist() {
    setPending(true);
    try {
      await apiPost("/api/trading/watchlist", { symbol, ...(name ? { name } : {}) });
      setAdded(true);
      toast.success(`${symbol} masuk daftar pantau.`);
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (added) {
    return (
      <Button variant="soft" className={cn("w-full", className)} disabled>
        <Check className="size-4" aria-hidden="true" />
        Sudah di daftar pantau
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      className={cn("w-full", className)}
      onClick={addToWatchlist}
      disabled={pending}
      aria-label={`Simpan ${symbol} ke daftar pantau`}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Star className="size-4" aria-hidden="true" />
      )}
      {pending ? "Menyimpan…" : "Simpan ke daftar pantau"}
    </Button>
  );
}
