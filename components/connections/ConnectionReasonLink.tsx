import Link from "next/link";
import { introductionDetailHref } from "@/lib/introduction-routes";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionReasonPayload } from "@/types";

export function ConnectionReasonLink({
  connectionReason,
  className,
  compact = false,
}: {
  connectionReason: ConnectionReasonPayload;
  className?: string;
  compact?: boolean;
}) {
  const {
    reason,
    introducerName,
    introducers,
    introductionStoryIds,
    storyHref,
    networkHref,
    kind,
    connectionDepth,
    label,
  } = connectionReason;

  const href =
    introductionStoryIds.length > 1 && networkHref
      ? networkHref
      : storyHref;

  const actionLabel =
    introductionStoryIds.length > 1
      ? `View ${introductionStoryIds.length} introductions`
      : "View introduction";

  if (!href) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {connectionReason.label}
      </p>
    );
  }

  const displayIntroducers =
    introducers.length > 0
      ? introducers
      : introducerName
        ? [{ id: "", name: introducerName, profilePicture: null }]
        : [];

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border border-primary/15 bg-primary/5 px-3 py-2",
        "hover:bg-primary/10 hover:border-primary/30 transition group",
        className
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {connectionDepth && connectionDepth >= 3
          ? `${connectionDepth} trusted connections away`
          : reason}
      </div>

      {connectionDepth === 1 && introducerName && kind !== "introduced_you" && kind !== "you_introduced" && (
        <div className="text-sm font-medium text-foreground mt-0.5">
          Introduced by {introducerName}
        </div>
      )}

      {connectionDepth === 2 && introducerName && (
        <div className="text-sm font-medium text-foreground mt-0.5">
          Connected through {introducerName}
        </div>
      )}

      {(!connectionDepth || connectionDepth <= 2) &&
        kind !== "mutual_introducer" &&
        kind !== "introduced_you" &&
        kind !== "you_introduced" &&
        !introducerName && (
          <div className="text-sm font-medium text-foreground mt-0.5">{label}</div>
        )}

      {kind === "introduced_you" && (
        <div className="text-sm font-medium text-foreground mt-0.5">
          They introduced you
        </div>
      )}

      {kind === "you_introduced" && (
        <div className="text-sm font-medium text-foreground mt-0.5">
          You introduced them
        </div>
      )}

      {kind === "mutual_introducer" && displayIntroducers.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {displayIntroducers.slice(0, 3).map((i) => (
            <div key={i.id || i.name} className="text-sm font-medium text-foreground">
              {i.name}
            </div>
          ))}
        </div>
      )}

      {(kind === "mutual_introducer" ||
        kind === "same_introducer_peer" ||
        kind === "second_degree") &&
        introducerName &&
        displayIntroducers.length <= 1 && (
          <div className="text-sm font-medium text-foreground mt-0.5">
            {introducerName}
          </div>
        )}

      {!compact && (
        <div className="flex items-center gap-1 text-xs text-primary font-medium mt-2 group-hover:underline">
          <ExternalLink size={12} />
          {actionLabel}
        </div>
      )}
      {compact && (
        <div className="text-xs text-primary font-medium mt-1 group-hover:underline">
          {actionLabel}
        </div>
      )}
    </Link>
  );
}

export function IntroductionStoryLink({
  storyId,
  label = "View introduction",
  className,
}: {
  storyId: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={introductionDetailHref(storyId)}
      className={cn(
        "inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline",
        className
      )}
    >
      <ExternalLink size={12} />
      {label}
    </Link>
  );
}
