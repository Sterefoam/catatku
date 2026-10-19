import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  indicatorClassName,
  tone = "primary",
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
  tone?: "primary" | "success" | "danger" | "warning";
}) {
  const tones = {
    primary: "bg-primary",
    success: "bg-success",
    danger: "bg-danger",
    warning: "bg-warning",
  } as const;
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          tones[tone],
          indicatorClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
