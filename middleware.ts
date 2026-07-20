import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { generateRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";
import { applySecurityHeaders, validateOrigin, originRejectedResponse } from "@/lib/security";
import { recordHttpRequest } from "@/lib/metrics";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get(REQUEST_ID_HEADER) || generateRequestId();
  const startedAt = performance.now();

  if (!validateOrigin(request)) {
    const rejected = originRejectedResponse(requestId);
    rejected.headers.set(REQUEST_ID_HEADER, requestId);
    return applySecurityHeaders(rejected);
  }

  const intlResponse = intlMiddleware(request);
  if (intlResponse.headers.get("location")) {
    intlResponse.headers.set(REQUEST_ID_HEADER, requestId);
    return applySecurityHeaders(intlResponse);
  }

  const authResponse = await updateSession(request);
  authResponse.headers.set(REQUEST_ID_HEADER, requestId);

  intlResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      authResponse.headers.append(key, value);
    } else if (!authResponse.headers.has(key)) {
      authResponse.headers.set(key, value);
    }
  });

  const durationMs = Math.round(performance.now() - startedAt);
  recordHttpRequest(request.method, request.nextUrl.pathname, authResponse.status, durationMs);

  return applySecurityHeaders(authResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|favicon.png|robots.txt|sitemap.xml|manifest.webmanifest|browserconfig.xml|offline|offline.html|sw.js|workbox/|icons/|uploads/|api/public|api/health|api/version|api/metrics).*)",
  ],
};
