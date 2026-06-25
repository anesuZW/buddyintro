"use client";

import Link from "next/link";
import { COPY } from "@/lib/copy";
import type { TrustProfilePayload } from "@/types";

export function SharedIntroducersPanel({
  trustProfile,
  onViewAll,
  compact = false,
}: {
  trustProfile: TrustProfilePayload;
  onViewAll?: () => void;
  compact?: boolean;
}) {
  const { sharedIntroducerCount, sharedIntroducers, trustLevelLabel, trustScore } =
    trustProfile;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {COPY.sharedIntroducers}
        </h3>
        <p className="text-lg font-bold text-foreground mt-1">
          {COPY.sharedIntroducerCount(sharedIntroducerCount)}
        </p>
        <p className="text-sm text-primary font-medium">{trustLevelLabel}</p>
        {!compact && (
          <p className="text-xs text-muted-foreground mt-1">
            {COPY.trustScore} {trustScore}
          </p>
        )}
      </div>

      {sharedIntroducers.length > 0 && (
        <ul className="space-y-2">
          {sharedIntroducers.slice(0, compact ? 3 : 6).map((s) => (
            <li key={s.id}>
              <Link
                href={s.storyHref}
                className="text-sm font-medium text-foreground hover:text-primary hover:underline"
              >
                {s.name}
                {s.category && (
                  <span className="text-xs text-muted-foreground ml-2">
                    · {s.category.name}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {sharedIntroducers.length > 3 && compact && (
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs text-primary font-medium hover:underline"
        >
          +{sharedIntroducers.length - 3} more
        </button>
      )}

      {onViewAll && !compact && (
        <button
          type="button"
          onClick={onViewAll}
          className="text-sm text-primary font-medium hover:underline"
        >
          {COPY.viewIntroductions}
        </button>
      )}
    </div>
  );
}
