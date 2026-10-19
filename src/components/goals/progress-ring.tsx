import { cn } from "@/lib/utils";

/**
 * Cincin progres target (0–100%). Memakai currentColor supaya otomatis
 * mengikuti token warna tema terang/gelap.
 */
export function ProgressRing({
  value,
  size = 68,
  strokeWidth = 7,
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (clamped / 100) * circumference;
  const complete = clamped >= 100;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={`Progres ${clamped}%`}
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className={cn(
            "transition-[stroke-dasharray] duration-700 ease-out",
            complete ? "text-success" : "text-primary",
          )}
        />
      </svg>
      <span
        aria-hidden="true"
        className="money absolute inset-0 flex items-center justify-center text-[14px] font-bold"
      >
        {clamped}%
      </span>
    </div>
  );
}
