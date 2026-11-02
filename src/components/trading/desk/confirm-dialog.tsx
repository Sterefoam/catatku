"use client";

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

/** Dialog konfirmasi sederhana (hapus / batalkan). */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Ya, lanjutkan",
  busy = false,
  tone = "danger",
  onConfirm,
  onClose,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  busy?: boolean;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogBody className="pb-1" />
        <DialogFooter className="flex gap-2">
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={busy}
          >
            Batal
          </Button>
          <Button
            size="lg"
            variant={tone === "danger" ? "danger" : "primary"}
            className="flex-1"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Memproses..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
