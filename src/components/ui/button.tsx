import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_rgba(14,122,86,0.7)] hover:brightness-105",
        soft: "bg-primary-soft text-primary hover:bg-primary-soft/80",
        outline:
          "border border-border bg-card text-foreground hover:bg-muted/70",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        danger: "bg-danger text-white shadow-sm hover:brightness-105",
        subtle: "bg-muted text-foreground hover:bg-muted/70",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px] [&_svg]:size-4",
        md: "h-11 px-5 [&_svg]:size-4",
        lg: "h-12 px-6 text-[15px] [&_svg]:size-5",
        icon: "size-10 [&_svg]:size-5",
        iconSm: "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
