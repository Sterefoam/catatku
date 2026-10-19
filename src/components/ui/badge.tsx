import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "primary" | "success" | "danger" | "warning" | "outline";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  outline: "border border-border text-muted-foreground",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
