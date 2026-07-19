import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isAppLocale } from "@/i18n/routing";

/** Load authenticated user's preferred language for locale resolution. */
export async function getSessionPreferredLanguage(): Promise<string | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { preferredLanguage: true },
    });

    return isAppLocale(profile?.preferredLanguage) ? profile.preferredLanguage : null;
  } catch {
    return null;
  }
}
