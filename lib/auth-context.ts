/**
 * Trusted auth context passed from middleware to server handlers.
 * Only middleware may set these headers — see lib/supabase/middleware.ts.
 */
export const TRUSTED_AUTH_HEADERS = {
  userId: "x-auth-user-id",
  email: "x-auth-email",
  emailConfirmed: "x-auth-email-confirmed",
} as const;

/** Prefix for all internal auth headers stripped before middleware validation. */
export const TRUSTED_AUTH_HEADER_PREFIX = "x-auth-";

/** Remove client-supplied internal auth headers before Supabase validation. */
export function stripTrustedAuthHeaders(headers: Headers): void {
  for (const [key] of headers.entries()) {
    if (key.toLowerCase().startsWith(TRUSTED_AUTH_HEADER_PREFIX)) {
      headers.delete(key);
    }
  }
}

export function setTrustedAuthHeaders(
  headers: Headers,
  user: { id: string; email?: string | null; email_confirmed_at?: string | null }
): void {
  headers.set(TRUSTED_AUTH_HEADERS.userId, user.id);
  headers.set(TRUSTED_AUTH_HEADERS.email, user.email ?? "");
  headers.set(
    TRUSTED_AUTH_HEADERS.emailConfirmed,
    user.email_confirmed_at ? "1" : "0"
  );
}
