"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
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
import { useApp } from "@/components/app/app-context";
import { apiDelete, apiErrorMessage } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import type { GoalDTO } from "@/lib/types";

export function DeleteGoalDialog({
  goal,
  onClose,
}: {
  goal: GoalDTO;
  onClose: () => void;
}) {
  const { currency, refresh } = useApp();
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await apiDelete(`/api/goals/${goal.id}`);
      toast.success(`Target “${goal.name}” dihapus.`);
      refresh();
      onClose();
    } catch (deleteError) {
      setError(apiErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus target?</DialogTitle>
          <DialogDescription>
            Target “{goal.name}” beserta progresnya akan dihapus permanen.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-2xl bg-danger-soft/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Terkumpul {formatMoney(goal.savedAmount, currency)} dari{" "}
              {formatMoney(goal.targetAmount, currency)}. Tindakan ini tidak bisa dibatalkan.
            </span>
          </div>
          {error ? <p className="text-[12px] font-medium text-danger">{error}</p> : null}
        </DialogBody>

        <DialogFooter>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={deleting}>
              Batal
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Menghapus..." : "Ya, hapus"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
