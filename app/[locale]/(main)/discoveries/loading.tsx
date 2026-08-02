import { ListLoading } from "@/components/ui/ListState";

export default function DiscoveriesLoading() {
  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <div className="animate-pulse space-y-2">
        <div className="h-7 w-40 rounded bg-muted" />
        <div className="h-4 w-full max-w-md rounded bg-muted" />
      </div>
      <div className="h-28 rounded-2xl bg-muted/50 animate-pulse" />
      <ListLoading variant="feed" label="Loading discoveries…" />
    </div>
  );
}
