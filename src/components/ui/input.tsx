import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] text-foreground shadow-[inset_0_1px_2px_rgba(16,32,26,0.04)] transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-20 w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[15px] text-foreground shadow-[inset_0_1px_2px_rgba(16,32,26,0.04)] transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-[13px] font-semibold text-muted-foreground", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {error ? (
        <p className="text-[12px] font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-12 w-full appearance-none rounded-2xl border border-border bg-card px-4 text-[15px] text-foreground transition-colors focus-visible:border-primary/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

export { Input, Textarea, Label, Field, Select };
