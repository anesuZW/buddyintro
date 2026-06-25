import "server-only";

import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { TRUSTED_AUTH_HEADERS } from "@/lib/auth-context";

/** Read middleware-validated identity from trusted internal headers. */
export function getAuthUserFromTrustedHeaders(): User | null {
  try {
    const h = headers();
    const id = h.get(TRUSTED_AUTH_HEADERS.userId);
    if (!id) return null;

    const email = h.get(TRUSTED_AUTH_HEADERS.email) ?? "";
    const emailConfirmed = h.get(TRUSTED_AUTH_HEADERS.emailConfirmed) === "1";

    return {
      id,
      email,
      email_confirmed_at: emailConfirmed ? new Date(0).toISOString() : undefined,
      user_metadata: {},
      app_metadata: {},
      aud: "authenticated",
      created_at: "",
    } as User;
  } catch {
    return null;
  }
}
