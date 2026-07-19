import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { resolveLocale } from "@/lib/i18n/resolve-locale";
import { getSessionPreferredLanguage } from "@/lib/i18n/session-locale";
import { LOCALE_COOKIE, routing } from "./routing";
export default getRequestConfig(async ({ requestLocale }) => {
  const cookieStore = cookies();
  const headerStore = headers();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value ?? null;
  const acceptLanguage = headerStore.get("accept-language");
  const userPreferredLanguage = await getSessionPreferredLanguage();
  const requested = await requestLocale;

  const locale = resolveLocale({
    requestLocale: requested,
    cookieLocale,
    acceptLanguage,
    userPreferredLanguage,
  });

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    onError(error) {
      if (error.code === "MISSING_MESSAGE") {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[i18n] ${error.message}`);
        }
        return;
      }
      throw error;
    },
    getMessageFallback({ namespace, key }) {
      const path = namespace ? `${namespace}.${key}` : key;
      if (process.env.NODE_ENV === "development") {
        return `[missing: ${path}]`;
      }
      return path;
    },
  };
});
