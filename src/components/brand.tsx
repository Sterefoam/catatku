import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[30%] bg-[linear-gradient(140deg,#129168_0%,#0b6a4d_55%,#0a4636_100%)] text-white shadow-[0_8px_18px_-8px_rgba(10,90,64,0.75),inset_0_1px_0_rgba(255,255,255,0.28)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="absolute -right-2 -top-2 size-7 rounded-full bg-white/15 blur-[1px]"
        aria-hidden
      />
      <Wallet style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2.1} />
    </span>
  );
}

export function BrandLockup({
  size = 40,
  showTagline = true,
  className,
}: {
  size?: number;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size={size} />
      <div className="leading-tight">
        <p className="text-[17px] font-bold tracking-tight">Catatku</p>
        {showTagline ? (
          <p className="text-[11px] font-medium text-muted-foreground">Uang rapi, hati tenang</p>
        ) : null}
      </div>
    </div>
  );
}
