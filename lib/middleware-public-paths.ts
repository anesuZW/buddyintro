/**
 * Paths that must never pass through auth/session middleware.
 * Used by middleware matcher (Next.js) and production certification tests.
 */

/** Regex segments excluded from middleware matcher (negative lookahead). */
export const MIDDLEWARE_MATCHER_EXCLUDES = [
  "_next/static",
  "_next/image",
  "_next/webpack-hmr",
  "favicon.ico",
  "favicon.png",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "browserconfig.xml",
  "offline",
  "offline.html",
  "sw.js",
  "workbox/",
  "icons/",
  "uploads/",
  "api/public",
  "api/health",
  "api/version",
  "api/metrics",
] as const;

/**
 * Static matcher literal — Next.js middleware config must be build-time analyzable.
 * Keep in sync with MIDDLEWARE_MATCHER_EXCLUDES (verified in tests).
 */
export const MIDDLEWARE_MATCHER =
  "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|favicon.png|robots.txt|sitemap.xml|manifest.webmanifest|browserconfig.xml|offline|offline.html|sw.js|workbox/|icons/|uploads/|api/public|api/health|api/version|api/metrics).*)";

export function buildMiddlewareMatcher(): string {
  return MIDDLEWARE_MATCHER;
}

/** Locale-stripped path prefixes allowed without authentication. */
export const AUTH_PUBLIC_PATH_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/invite/",
  "/invite-preview/",
  "/privacy",
  "/terms",
  "/cookies",
  "/offline",
  "/_next",
  "/favicon",
  "/icons/",
  "/manifest.webmanifest",
  "/sw.js",
  "/workbox/",
  "/uploads/",
  "/api/public",
  "/api/auth/",
  "/api/health",
  "/api/version",
  "/api/metrics",
  "/api/share/target",
  "/auth/",
] as const;

export function isAuthPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return AUTH_PUBLIC_PATH_PREFIXES.some(
    (prefix) => prefix !== "/" && pathname.startsWith(prefix)
  );
}
