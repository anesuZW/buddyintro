/** Middleware auth segment headers — instrumentation only (PROFILE_PRODUCTION / AUTH_PROFILE). */
export const MIDDLEWARE_AUTH_TIMING_HEADERS = {
  createClient: "x-auth-create-client-ms",
  session: "x-auth-session-ms",
  getUser: "x-auth-get-user-ms",
  refresh: "x-auth-refresh-ms",
  response: "x-auth-response-ms",
  total: "x-auth-profile-middleware-ms",
} as const;

export function isMiddlewareAuthTimingEnabled(): boolean {
  return process.env.AUTH_PROFILE === "1" || process.env.PROFILE_PRODUCTION === "1";
}

export type MiddlewareAuthSegmentTimings = {
  createClientMs: number;
  /** Local session/cookie work inside getUser (excludes Auth HTTP). */
  loadSessionMs: number;
  /** GET /auth/v1/user network time observed during getUser. */
  getUserNetworkMs: number;
  /** POST /token refresh network time observed during getUser. */
  refreshNetworkMs: number;
  responseBuildMs: number;
  totalMs: number;
};

/** Wrap getUser() to attribute Supabase Auth HTTP without changing call semantics. */
export async function measureGetUserWithFetchSplit<T>(
  getUser: () => Promise<T>
): Promise<{ result: T; getUserNetworkMs: number; refreshNetworkMs: number }> {
  let getUserNetworkMs = 0;
  let refreshNetworkMs = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const start = performance.now();
    try {
      return await originalFetch(input, init);
    } finally {
      const ms = Math.round(performance.now() - start);
      if (url.includes("/auth/v1/token") || url.includes("/token?grant_type")) {
        refreshNetworkMs += ms;
      } else if (url.includes("/auth/v1/user")) {
        getUserNetworkMs += ms;
      }
    }
  };

  try {
    const result = await getUser();
    return { result, getUserNetworkMs, refreshNetworkMs };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

export function applyMiddlewareAuthTimingHeaders(
  response: Response,
  timings: MiddlewareAuthSegmentTimings,
  authProfileId?: string | null
): void {
  const h = MIDDLEWARE_AUTH_TIMING_HEADERS;
  response.headers.set(h.createClient, String(timings.createClientMs));
  response.headers.set(h.session, String(timings.loadSessionMs));
  response.headers.set(h.getUser, String(timings.getUserNetworkMs));
  response.headers.set(h.refresh, String(timings.refreshNetworkMs));
  response.headers.set(h.response, String(timings.responseBuildMs));
  response.headers.set(h.total, String(timings.totalMs));
  response.headers.set("x-auth-profile-middleware-ms", String(timings.totalMs));
  if (process.env.PROFILE_PRODUCTION === "1") {
    response.headers.set("x-bench-auth-ms", String(timings.totalMs));
  }
  if (authProfileId) {
    response.headers.set("x-auth-profile-id", authProfileId);
    if (process.env.PROFILE_PRODUCTION === "1") {
      response.headers.set("x-bench-request-id", authProfileId);
    }
  }
}

export function logMiddlewareAuthSegments(
  authProfileId: string | null,
  pathname: string,
  timings: MiddlewareAuthSegmentTimings
): void {
  console.log(
    `[AUTH-PROFILE][${authProfileId ?? "unknown"}] middleware segments path=${pathname}\n` +
      `createClient=${timings.createClientMs}ms\n` +
      `loadSession=${timings.loadSessionMs}ms\n` +
      `getUserNetwork=${timings.getUserNetworkMs}ms\n` +
      `refreshNetwork=${timings.refreshNetworkMs}ms\n` +
      `responseBuild=${timings.responseBuildMs}ms\n` +
      `total=${timings.totalMs}ms`
  );
}
