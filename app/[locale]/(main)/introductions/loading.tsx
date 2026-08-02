import { ListLoading } from "@/components/ui/ListState";

export default function IntroductionsLoading() {
  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <div className="h-7 w-44 rounded bg-muted animate-pulse" />
      <div className="h-10 rounded-full bg-muted animate-pulse" />
      <ListLoading variant="list" label="Loading introductions…" />
    </div>
  );
}
