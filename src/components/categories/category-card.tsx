import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/category-icon";
import type { CategoryDTO } from "@/lib/types";

export function CategoryCard({
  category,
  onSelect,
}: {
  category: CategoryDTO;
  onSelect: (category: CategoryDTO) => void;
}) {
  const usage = category.transactionCount ?? 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      aria-label={`Ubah kategori ${category.name}`}
      className="group flex min-h-[7.5rem] flex-col justify-between gap-3 rounded-3xl border border-border/80 bg-card p-3.5 text-left shadow-[0_1px_2px_rgba(16,32,26,0.04),0_14px_34px_-22px_rgba(16,32,26,0.28)] transition-all duration-200 hover:border-primary/40 hover:shadow-[0_1px_2px_rgba(16,32,26,0.05),0_18px_36px_-20px_rgba(16,32,26,0.34)] active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <CategoryBadge icon={category.icon} color={category.color} />
        {category.isDefault ? (
          <Badge tone="outline" className="shrink-0 px-2 py-0.5 text-[10px]">
            Bawaan
          </Badge>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-semibold leading-tight">{category.name}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {usage === 0 ? "Belum dipakai" : `${usage} transaksi`}
        </p>
      </div>
    </button>
  );
}
