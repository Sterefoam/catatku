import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Memuat halaman">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-44" />
        </div>
        <Skeleton className="size-10 rounded-full" />
      </div>
      <Skeleton className="h-52 w-full rounded-[1.8rem]" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
      </div>
      <Skeleton className="h-24 rounded-3xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    </div>
  );
}
