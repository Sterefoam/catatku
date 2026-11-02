"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { apiErrorMessage, apiPatch } from "@/lib/client-api";
import { fmtPrice, fmtQty } from "@/lib/trading/format";
import type { OrderDTO } from "@/lib/trading/types";
import { parsePriceInput } from "./desk-shared";

/**
 * Dialog isi / tutup order kertas. Harga manual opsional; bila dikosongkan
 * server memakai harga pasar terakhir (data gratis, bisa tertunda).
 */
export function OrderActionDialog({
  order,
  action,
  onClose,
}: {
  order: OrderDTO;
  action: "fill" | "close";
  onClose: () => void;
}) {
  const router = useRouter();
  const filling = action === "fill";
  const [priceInput, setPriceInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setError(null);
    let price: number | null = null;
    if (priceInput.trim()) {
      price = parsePriceInput(priceInput);
      if (!price) {
        setError("Harga tidak valid. Contoh: 364.18");
        return;
      }
    }
    setBusy(true);
    try {
      await apiPatch(`/api/trading/orders/${order.id}`, { action, price });
      toast.success(
        filling
          ? `Order ${order.symbol} terisi.`
          : `Posisi ${order.symbol} ditutup dan masuk jurnal.`,
      );
      onClose();
      router.refresh();
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {filling ? `Isi order ${order.symbol}` : `Tutup posisi ${order.symbol}`}
          </DialogTitle>
          <DialogDescription>
            {filling
              ? "Order latihan diisi pada harga pasar terakhir. Kosongkan harga untuk memakai data otomatis."
              : "Posisi ditutup pada harga pasar terakhir. Kosongkan harga untuk memakai data otomatis."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-surface/70 px-3 py-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Rencana
              </p>
              <p className="money mt-0.5 text-[13px] font-semibold">
                {fmtQty(order.qty)} lembar · masuk {fmtPrice(order.entry)}
              </p>
            </div>
            <div className="rounded-2xl bg-surface/70 px-3 py-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Batas
              </p>
              <p className="money mt-0.5 text-[13px] font-semibold">
                rugi {fmtPrice(order.stop)} · target {fmtPrice(order.target)}
              </p>
            </div>
          </div>

          <Field
            label="Harga manual ($, opsional)"
            htmlFor="order-action-price"
            error={error}
            hint={filling ? "Harga pengisian order." : "Harga penutupan posisi."}
          >
            <Input
              id="order-action-price"
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              placeholder="Kosongkan untuk harga pasar"
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>

          {!filling ? (
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Alasan keluar diisi otomatis: batas rugi bila harga tutup ≤ batas rugi, target untung
              bila harga tutup ≥ target, selain itu ditutup manual.
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button size="lg" className="w-full" onClick={submit} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {busy ? "Memproses..." : filling ? "Isi order sekarang" : "Tutup posisi sekarang"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
