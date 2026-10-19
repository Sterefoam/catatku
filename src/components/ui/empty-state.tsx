import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 text-center",
        compact ? "gap-2 px-5 py-7" : "gap-3 px-6 py-10",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-[16rem] text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
