import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { isAppLocale } from "@/i18n/routing";

/**
 * Load authenticated user's preferred language for locale resolution.
 * Uses request-scoped getCurrentUser() so middleware-validated identity is reused
 * (no second supabase.auth.getUser() / User.findUnique on the same request).
 */
export const getSessionPreferredLanguage = cache(async (): Promise<string | null> => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    return isAppLocale(user.preferredLanguage) ? user.preferredLanguage : null;
  } catch {
    return null;
  }
});
