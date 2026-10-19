"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  X,
} from "lucide-react";
import { CategoryBadge } from "@/components/category-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { formatDayLabel } from "@/lib/date";
import { MINUS, formatMoney } from "@/lib/money";
import type { CategoryDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { itemTitle, sourceLabel, type InboxItem } from "./types";

export type InboxBusyAction = "confirm" | "ignore" | null;

export function InboxItemCard({
  item,
  categories,
  currency,
  today,
  selectedCategoryId,
  busyAction,
  disabled,
  onSelectCategory,
  onConfirm,
  onIgnore,
}: {
  item: InboxItem;
  categories: CategoryDTO[];
  currency: string;
  today: string;
  selectedCategoryId: string;
  busyAction: InboxBusyAction;
  disabled: boolean;
  onSelectCategory: (itemId: string, categoryId: string) => void;
  onConfirm: (item: InboxItem) => void;
  onIgnore: (item: InboxItem) => void;
}) {
  const typeCategories = React.useMemo(
    () => categories.filter((category) => category.type === item.type),
    [categories, item.type],
  );
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
  const hasCategories = typeCategories.length > 0;
  const isIncome = item.type === "income";
  const busy = busyAction !== null;
  const titleId = `inbox-item-title-${item.id}`;
  const selectId = `inbox-item-category-${item.id}`;

  const amountText = isIncome
    ? formatMoney(item.amount, currency, { signed: true })
    : `${MINUS}${formatMoney(item.amount, currency)}`;

  return (
    <Card role="article" aria-labelledby={titleId} className="animate-rise overflow-hidden">
      <div className="space-y-3.5 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={item.source === "email" ? "primary" : "neutral"}>
            {item.source === "email" ? (
              <Mail className="size-3" aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="size-3" aria-hidden="true" />
            )}
            {sourceLabel(item.source)}
          </Badge>
          <Badge tone={isIncome ? "success" : "danger"}>
            {isIncome ? "Pemasukan" : "Pengeluaran"}
          </Badge>
          {item.confidence === "low" ? (
            <Badge tone="warning">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Perlu dicek
            </Badge>
          ) : null}
          <time
            dateTime={item.date}
            className="ml-auto shrink-0 text-[11.5px] font-medium text-muted-foreground"
          >
            {formatDayLabel(item.date, today)}
          </time>
        </div>

        <div className="flex items-start gap-3">
          {selectedCategory ? (
            <CategoryBadge
              icon={selectedCategory.icon}
              color={selectedCategory.color}
              size="md"
              className="mt-0.5"
            />
          ) : (
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <InboxIcon className="size-5" aria-hidden="true" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p id={titleId} className="truncate text-[14.5px] font-semibold leading-snug">
              {itemTitle(item)}
            </p>
            {item.rawSubject ? (
              <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                <Mail className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate" title={item.rawSubject}>
                  {item.rawSubject}
                </span>
              </p>
            ) : null}
          </div>

          <p
            className={cn(
              "money shrink-0 text-[16px] font-bold leading-tight",
              isIncome ? "text-success" : "text-danger",
            )}
          >
            {amountText}
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={selectId}
            className="text-[11.5px] font-semibold text-muted-foreground"
          >
            Kategori pencatatan
          </label>
          {hasCategories ? (
            <Select
              id={selectId}
              value={selectedCategoryId}
              onChange={(event) => onSelectCategory(item.id, event.target.value)}
              disabled={disabled || busy}
              className="h-11 rounded-xl text-[13.5px]"
            >
              {typeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
              Belum ada kategori {isIncome ? "pemasukan" : "pengeluaran"}.{" "}
              <Link
                href="/kategori"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Tambah kategori
              </Link>{" "}
              dulu supaya transaksi ini bisa dicatat.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => onConfirm(item)}
            disabled={disabled || busy || !hasCategories}
            aria-busy={busyAction === "confirm" || undefined}
            className="h-11 flex-1 px-3.5"
          >
            {busyAction === "confirm" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {busyAction === "confirm" ? "Menyimpan…" : "Konfirmasi"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onIgnore(item)}
            disabled={disabled || busy}
            aria-busy={busyAction === "ignore" || undefined}
            aria-label="Abaikan transaksi ini"
            className="h-11 shrink-0 px-3.5"
          >
            {busyAction === "ignore" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <X className="size-4" aria-hidden="true" />
            )}
            Abaikan
          </Button>
        </div>
      </div>
    </Card>
  );
}
