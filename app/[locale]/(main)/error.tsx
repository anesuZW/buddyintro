"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Recovers from render failures in the authenticated shell.
 * Never surfaces error.message or stack traces to users.
 */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[main/error]", error.digest ?? error.name);
  }, [error]);

  const isHookCascade =
    typeof error.message === "string" &&
    (error.message.includes("useContext") || error.message.includes("Invalid hook"));

  return (
    <div className="px-4 py-12 text-center max-w-md mx-auto">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mt-2">
        {isHookCascade
          ? "A temporary rendering error occurred — often caused by a slow server response. Try again."
          : "An unexpected error occurred. Please try again."}
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
