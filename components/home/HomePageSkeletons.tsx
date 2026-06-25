export function HomeSecondarySkeleton() {
  return (
    <div className="px-4 pb-4 space-y-4 animate-pulse">
      <div className="rounded-xl border border-border bg-muted/40 h-24" />
      <div className="rounded-xl border border-border bg-muted/40 h-20" />
    </div>
  );
}

export function HomeFeedSkeleton() {
  return (
    <div className="px-4 pb-6 space-y-4 animate-pulse">
      <div className="flex gap-4 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 w-16 rounded-full bg-muted shrink-0" />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-muted/40 h-32" />
      <div className="rounded-xl border border-border bg-muted/40 h-32" />
    </div>
  );
}

export function HomeStatsSkeleton() {
  return (
    <section className="px-4 pt-4 pb-2 animate-pulse">
      <div className="rounded-2xl border border-primary/15 bg-muted/40 h-28 mb-4" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-muted/50 h-20" />
        ))}
      </div>
    </section>
  );
}
