"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { LOCALE_COOKIE, localeLabels, type AppLocale, isAppLocale } from "@/i18n/routing";

type LanguageContextValue = {
  locale: AppLocale;
  switchLocale: (locale: AppLocale) => Promise<void>;
  isSwitching: boolean;
  localeLabels: typeof localeLabels;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: AppLocale;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const activeLocale = useLocale();
  const [locale, setLocale] = useState<AppLocale>(initialLocale);
  const [isSwitching, startTransition] = useTransition();

  const switchLocale = useCallback(
    async (nextLocale: AppLocale) => {
      if (!isAppLocale(nextLocale) || nextLocale === locale) return;

      document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

      try {
        await fetch("/api/user/language", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferredLanguage: nextLocale }),
        });
      } catch {
        /* guest users or offline — cookie still applies */
      }

      setLocale(nextLocale);
      startTransition(() => {
        router.replace(pathname, { locale: nextLocale });
        router.refresh();
      });
    },
    [locale, pathname, router]
  );

  const value = useMemo(
    () => ({
      locale: (activeLocale as AppLocale) || locale,
      switchLocale,
      isSwitching,
      localeLabels,
    }),
    [activeLocale, isSwitching, locale, switchLocale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
