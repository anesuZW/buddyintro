import "server-only";

import { runWithPerf } from "@/lib/perf/context";
import {
  applyAuthProfileResponseHeaders,
  finishAuthRouteProfile,
  isAuthProfileEnabled,
  runWithAuthProfile,
} from "@/lib/auth-profile";

/** Wrap an API route handler to capture execution time and Prisma query stats. */
export function withPerfApi(
  label: string,
  handler: (request: Request) => Promise<Response>
) {
  return (request: Request) => {
    const run = () =>
      runWithPerf({ kind: "api", label, method: request.method }, () => handler(request));
    return isAuthProfileEnabled() ? runWithAuthProfile(run) : run();
  };
}

/** Attach auth profile response headers after handler completes. */
export function withAuthProfileResponse(
  response: Response,
  input: { totalMs: number; serializeMs?: number; otherMs?: number }
): Response {
  return applyAuthProfileResponseHeaders(response, input);
}
