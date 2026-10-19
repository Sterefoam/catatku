"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  tone?: "default" | "income" | "expense";
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}

/**
 * Kontrol pilihan tersegmentasi (dipakai untuk jenis transaksi & rentang grafik).
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex w-full items-center gap-1 rounded-2xl bg-muted p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-200",
              size === "sm" ? "h-8 px-2.5 text-[12.5px]" : "h-10 px-3 text-[13.5px]",
              active
                ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,32,26,0.08),0_4px_12px_-6px_rgba(16,32,26,0.25)]"
                : "text-muted-foreground hover:text-foreground",
              active && option.tone === "income" && "text-success",
              active && option.tone === "expense" && "text-danger",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
