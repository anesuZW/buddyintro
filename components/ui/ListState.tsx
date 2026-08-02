"use client";

import Link from "next/link";

export function ListLoading({
  label = "Loading…",
  variant = "list",
}: {
  label?: string;
  variant?: "list" | "feed" | "conversations";
}) {
  if (variant === "feed") {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true" aria-label={label}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-muted" />
                <div className="h-3 w-1/4 rounded bg-muted" />
              </div>
            </div>
            <div className="h-24 rounded-xl bg-muted/60" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "conversations") {
    return (
      <div className="space-y-2 animate-pulse" aria-busy="true" aria-label={label}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-3">
            <div className="h-12 w-12 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-pulse" aria-busy="true" aria-label={label}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-4 flex gap-3">
          <div className="h-14 w-14 rounded-xl bg-muted shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListError({
  message = "Something went wrong. Please try again.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card p-6 text-center space-y-3">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && (
        <button type="button" className="text-sm text-primary hover:underline" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function ListEmpty({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="card p-8 text-center space-y-4">
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
