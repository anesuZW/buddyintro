import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getPathnameWithoutLocale, prefixPathWithLocale } from "@/lib/i18n/resolve-locale";
import { isAuthPublicPath } from "@/lib/middleware-public-paths";
import { defaultLocale, isAppLocale } from "@/i18n/routing";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { setTrustedAuthHeaders, stripTrustedAuthHeaders } from "@/lib/auth-context";
import {
  applyMiddlewareAuthTimingHeaders,
  isMiddlewareAuthTimingEnabled,
  logMiddlewareAuthSegments,
  measureGetUserWithFetchSplit,
} from "@/lib/middleware-auth-timing";
import { recordRuntimeAuthMiddleware } from "@/lib/perf/runtime-counters";
import { authUploadRejectResponse } from "@/lib/upload-reject";

type MiddlewareAuthIdentity = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

/**
 * Resolve auth identity for middleware gating.
 * Prefers getClaims() when available (local JWT verify / JWKS — Supabase SSR guidance).
 * Falls back to getUser() when getClaims is missing or claims are unavailable
 * (e.g. @supabase/supabase-js < getClaims, or symmetric JWT projects).
 */
async function resolveMiddlewareAuthIdentity(supabase: {
  auth: {
    getClaims?: () => Promise<{
      data: { claims?: Record<string, unknown> | null } | null;
      error: { message?: string } | null;
    }>;
    getUser: () => Promise<{
      data: { user: MiddlewareAuthIdentity | null };
    }>;
  };
}): Promise<{ user: MiddlewareAuthIdentity | null; method: "getClaims" | "getUser" }> {
  const getClaims = supabase.auth.getClaims;
  if (typeof getClaims === "function") {
    try {
      const { data, error } = await getClaims();
      const claims = data?.claims ?? null;
      const sub = claims && typeof claims.sub === "string" ? claims.sub : null;
      if (!error && claims && sub) {
        const email = typeof claims.email === "string" ? claims.email : null;
        const meta = claims.user_metadata;
        const emailVerifiedMeta =
          meta &&
          typeof meta === "object" &&
          "email_verified" in meta &&
          (meta as { email_verified?: unknown }).email_verified === true;
        const emailConfirmedAt =
          typeof claims.email_confirmed_at === "string"
            ? claims.email_confirmed_at
            : emailVerifiedMeta
              ? new Date(0).toISOString()
              : null;
        return {
          user: {
            id: sub,
            email,
            email_confirmed_at: emailConfirmedAt,
          },
          method: "getClaims",
        };
      }
    } catch {
      // Fall through to getUser — preserves auth when getClaims fails.
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, method: "getUser" };
}

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

/**
 * Refreshes the user's auth session for every request.
 * Wired up from /middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  const timingEnabled = isMiddlewareAuthTimingEnabled();
  const totalStart = timingEnabled ? performance.now() : 0;

  stripTrustedAuthHeaders(request.headers);

  let response = NextResponse.next({ request: { headers: request.headers } });

  const createClientStart = timingEnabled ? performance.now() : 0;
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );
  const createClientMs = timingEnabled
    ? Math.round(performance.now() - createClientStart)
    : 0;

  const authProfileId = timingEnabled ? crypto.randomUUID().slice(0, 8) : null;
  const getUserStart = timingEnabled ? performance.now() : 0;

  const resolveCall = () => resolveMiddlewareAuthIdentity(supabase);
  const measured = timingEnabled
    ? await measureGetUserWithFetchSplit(resolveCall)
    : {
        result: await resolveCall(),
        getUserNetworkMs: 0,
        refreshNetworkMs: 0,
      };

  const { user, method: resolveMethod } = measured.result;

  const getUserTotalMs = timingEnabled ? Math.round(performance.now() - getUserStart) : 0;
  const getUserNetworkMs = measured.getUserNetworkMs;
  const refreshNetworkMs = measured.refreshNetworkMs;
  const loadSessionMs = timingEnabled
    ? Math.max(0, getUserTotalMs - getUserNetworkMs - refreshNetworkMs)
    : 0;

  const { pathname: rawPathname } = request.nextUrl;
  const pathname = getPathnameWithoutLocale(rawPathname);
  const localeSegment = rawPathname.startsWith("/") ? rawPathname.split("/")[1] : "";
  const locale = isAppLocale(localeSegment) ? localeSegment : defaultLocale;
  const responseBuildStart = timingEnabled ? performance.now() : 0;

  if (user) {
    setTrustedAuthHeaders(request.headers, user);
  }

  if (timingEnabled && authProfileId) {
    request.headers.set("x-auth-profile-id", authProfileId);
  }

  // Rebuild response so RSC sees trusted auth headers, but keep session cookies
  // written during getClaims/getUser refresh (overwriting response would drop them).
  const previous = response;
  response = NextResponse.next({ request: { headers: request.headers } });
  copyCookies(previous, response);

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password");

  const isPublic = isAuthPublicPath(pathname);

  let finalResponse: NextResponse;

  if (!user && !isAuthPage && !isPublic) {
    if (pathname.startsWith("/api/")) {
      if (pathname === "/api/media/upload") {
        console.warn(
          JSON.stringify({
            level: "warn",
            msg: "upload rejected — authentication",
            route: pathname,
            userId: "anonymous",
            contentLength: Number(request.headers.get("content-length") || 0) || undefined,
            rejectSource: "auth",
            rejectCode: "permission_denied",
            reason: "User not authenticated",
          })
        );
      }
      finalResponse =
        pathname === "/api/media/upload"
          ? authUploadRejectResponse(401, "User not authenticated", "Unauthorized")
          : NextResponse.json({ error: "Unauthorized", code: "unauthenticated" }, { status: 401 });
    } else {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = prefixPathWithLocale("/login", locale);
      redirectUrl.searchParams.set("next", pathname);
      finalResponse = NextResponse.redirect(redirectUrl);
    }
  } else if (user && isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = prefixPathWithLocale("/home", locale);
    finalResponse = NextResponse.redirect(redirectUrl);
  } else {
    finalResponse = response;
  }

  const responseBuildMs = timingEnabled
    ? Math.round(performance.now() - responseBuildStart)
    : 0;
  const totalMs = timingEnabled ? Math.round(performance.now() - totalStart) : 0;

  if (timingEnabled) {
    const timings = {
      createClientMs,
      loadSessionMs,
      getUserNetworkMs,
      refreshNetworkMs,
      responseBuildMs,
      totalMs,
      resolveMethod,
    };
    logMiddlewareAuthSegments(authProfileId, pathname, timings);
    applyMiddlewareAuthTimingHeaders(finalResponse, timings, authProfileId);
    recordRuntimeAuthMiddleware(totalMs);
  }

  return finalResponse;
}
