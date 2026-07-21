import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/** Validate Origin/Referer for mutating requests. */
export function validateOrigin(request: NextRequest): boolean {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return true;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!origin && !referer) return true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const allowed = new Set([...(appUrl ? [appUrl] : []), ...ALLOWED_ORIGINS]);

  if (origin && [...allowed].some((base) => origin === base || origin.startsWith(`${base}/`))) {
    return true;
  }
  if (referer && [...allowed].some((base) => referer.startsWith(`${base}/`) || referer === base)) {
    return true;
  }

  return allowed.size === 0;
}

export function securityHeaders(): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https: wss://*.supabase.co wss://*.supabase.in ws://localhost:* ws://127.0.0.1:*",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), notifications=(self)",
    "Content-Security-Policy": csp,
    ...(process.env.NODE_ENV === "production"
      ? { "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload" }
      : {}),
  };
}

export function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders())) {
    response.headers.set(key, value);
  }
  return response;
}

export function originRejectedResponse(requestId?: string) {
  return NextResponse.json(
    { error: "Invalid origin", code: "csrf_rejected", requestId },
    { status: 403 }
  );
}
