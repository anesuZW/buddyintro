"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Recovers from Fast Refresh hook errors caused by upstream SSR failures (e.g. DB timeouts).
 * Invalid hook call cascades are a symptom — this boundary lets users retry without a full reload.
 */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[main/error]", error);
  }, [error]);

  return (
    <div className="px-4 py-12 text-center max-w-md mx-auto">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mt-2">
        {error.message.includes("useContext") || error.message.includes("Invalid hook")
          ? "A temporary rendering error occurred — often caused by a slow server response. Try again."
          : error.message || "An unexpected error occurred."}
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
