export default function ProfileLoading() {
  return (
    <div className="px-4 pt-6 pb-6 space-y-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-1/2 rounded bg-muted" />
          <div className="h-3 w-1/3 rounded bg-muted" />
        </div>
      </div>
      <div className="h-24 rounded-2xl bg-muted/50" />
      <div className="h-40 rounded-2xl bg-muted/40" />
    </div>
  );
}
