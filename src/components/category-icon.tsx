import {
  Baby,
  Bike,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Coffee,
  Droplets,
  Dumbbell,
  Ellipsis,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  PawPrint,
  Phone,
  PiggyBank,
  Plane,
  PlusCircle,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ICON_MAP: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  car: Car,
  bus: Bus,
  fuel: Fuel,
  bike: Bike,
  plane: Plane,
  receipt: Receipt,
  wifi: Wifi,
  phone: Phone,
  zap: Zap,
  droplets: Droplets,
  home: Home,
  "heart-pulse": HeartPulse,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  "gamepad-2": Gamepad2,
  shirt: Shirt,
  sparkles: Sparkles,
  "paw-print": PawPrint,
  baby: Baby,
  gift: Gift,
  wallet: Wallet,
  briefcase: Briefcase,
  "trending-up": TrendingUp,
  landmark: Landmark,
  "piggy-bank": PiggyBank,
  "plus-circle": PlusCircle,
  ellipsis: Ellipsis,
};

export function iconFor(name?: string | null): LucideIcon {
  return (name && ICON_MAP[name]) || Ellipsis;
}

interface CategoryIconProps {
  name?: string | null;
  className?: string;
  strokeWidth?: number;
}

export function CategoryIcon({ name, className, strokeWidth = 2 }: CategoryIconProps) {
  const Icon = iconFor(name);
  return <Icon className={cn("size-5", className)} strokeWidth={strokeWidth} aria-hidden />;
}

export function CategoryBadge({
  icon,
  color,
  size = "md",
  className,
}: {
  icon?: string | null;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-8 rounded-xl",
    md: "size-10 rounded-2xl",
    lg: "size-12 rounded-2xl",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        sizes[size],
        className,
      )}
      style={{
        backgroundColor: `${color}1f`,
        color,
        boxShadow: `inset 0 0 0 1px ${color}33`,
      }}
    >
      <CategoryIcon name={icon} className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}
