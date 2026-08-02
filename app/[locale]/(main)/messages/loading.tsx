import { ListLoading } from "@/components/ui/ListState";

export default function MessagesLoading() {
  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <div className="h-7 w-36 rounded bg-muted animate-pulse" />
      <ListLoading variant="conversations" label="Loading conversations…" />
    </div>
  );
}
