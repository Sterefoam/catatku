/** Loading skeleton untuk semua halaman Meja Trading. */
export default function TradingLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-3 w-28 rounded-full bg-muted" />
        <div className="h-7 w-44 rounded-full bg-muted" />
        <div className="h-3 w-64 rounded-full bg-muted" />
      </div>

      <div className="h-14 rounded-2xl border border-border/70 bg-card" />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 rounded-2xl bg-muted/70" />
        ))}
      </div>

      <div className="h-40 rounded-3xl border border-border/70 bg-card" />
      <div className="h-28 rounded-3xl border border-border/70 bg-card" />
      <div className="h-24 rounded-3xl border border-border/70 bg-card" />

      <p className="sr-only">Memuat Meja Trading…</p>
    </div>
  );
}
