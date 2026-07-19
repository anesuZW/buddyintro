import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { generateRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";
import { applySecurityHeaders, validateOrigin, originRejectedResponse } from "@/lib/security";
import { recordHttpRequest } from "@/lib/metrics";

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get(REQUEST_ID_HEADER) || generateRequestId();
  const startedAt = performance.now();

  if (!validateOrigin(request)) {
    const rejected = originRejectedResponse(requestId);
    rejected.headers.set(REQUEST_ID_HEADER, requestId);
    return applySecurityHeaders(rejected);
  }

  const response = await updateSession(request);
  response.headers.set(REQUEST_ID_HEADER, requestId);

  const durationMs = Math.round(performance.now() - startedAt);
  recordHttpRequest(request.method, request.nextUrl.pathname, response.status, durationMs);

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|offline|icons/|uploads/|api/public|api/health|api/version|api/metrics).*)",
  ],
};
