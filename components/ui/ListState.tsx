"use client";

export function ListLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="card p-6 text-center text-sm text-muted-foreground animate-pulse">
      {label}
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

export function ListEmpty({ message }: { message: string }) {
  return (
    <div className="card p-6 text-center text-sm text-muted-foreground">{message}</div>
  );
}
