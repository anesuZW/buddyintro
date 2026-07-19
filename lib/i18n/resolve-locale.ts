import {
  defaultLocale,
  isAppLocale,
  locales,
  type AppLocale,
} from "@/i18n/routing";

type ResolveLocaleInput = {
  requestLocale?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
  userPreferredLanguage?: string | null;
};

/** Priority: user profile > explicit cookie > request locale > browser > English. */
export function resolveLocale(input: ResolveLocaleInput): AppLocale {
  if (isAppLocale(input.userPreferredLanguage)) {
    return input.userPreferredLanguage;
  }

  if (isAppLocale(input.cookieLocale)) {
    return input.cookieLocale;
  }

  if (isAppLocale(input.requestLocale)) {
    return input.requestLocale;
  }

  const browserLocale = detectBrowserLocale(input.acceptLanguage);
  if (browserLocale) return browserLocale;

  return defaultLocale;
}

export function detectBrowserLocale(acceptLanguage?: string | null): AppLocale | null {
  if (!acceptLanguage) return null;

  const candidates = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0]?.trim().toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    const exact = locales.find((locale) => locale === candidate);
    if (exact) return exact;

    const base = candidate.split("-")[0];
    const baseMatch = locales.find((locale) => locale === base);
    if (baseMatch) return baseMatch;
  }

  return null;
}

export function getPathnameWithoutLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || "/";
    }
  }
  return pathname;
}

export function prefixPathWithLocale(pathname: string, locale: AppLocale): string {
  if (locale === defaultLocale) return pathname;
  if (pathname === "/") return `/${locale}`;
  return `/${locale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
