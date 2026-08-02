"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Locale-segment error boundary (auth, legal, invite pages outside (main)).
 * Never surfaces error.message or stack traces to users.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[locale/error]", error.digest ?? error.name);
  }, [error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        We could not load this page. Please try again — if it keeps happening, sign out and
        back in.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/70 mt-2">Ref: {error.digest}</p>
      ) : null}
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
