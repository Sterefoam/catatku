import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  backHref,
  action,
  className,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: React.ReactNode;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3 pb-5", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {backHref ? (
          <Link
            href={backHref}
            className="-ml-1.5 mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Kembali"
          >
            <ChevronLeft className="size-5" />
          </Link>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="truncate text-[22px] font-bold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
