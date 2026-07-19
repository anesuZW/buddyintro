import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getPathnameWithoutLocale, prefixPathWithLocale } from "@/lib/i18n/resolve-locale";
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

  const getUserCall = () => supabase.auth.getUser();
  const measured = timingEnabled
    ? await measureGetUserWithFetchSplit(getUserCall)
    : { result: await getUserCall(), getUserNetworkMs: 0, refreshNetworkMs: 0 };

  const {
    data: { user },
  } = measured.result;

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

  response = NextResponse.next({ request: { headers: request.headers } });

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup");

  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/invite-preview/") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/cookies") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/auth/");

  let finalResponse: NextResponse;

  if (!user && !isAuthPage && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = prefixPathWithLocale("/login", locale);
    redirectUrl.searchParams.set("next", pathname);
    finalResponse = NextResponse.redirect(redirectUrl);
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
    };
    logMiddlewareAuthSegments(authProfileId, pathname, timings);
    applyMiddlewareAuthTimingHeaders(finalResponse, timings, authProfileId);
    recordRuntimeAuthMiddleware(totalMs);
  }

  return finalResponse;
}
