import { defineRouting } from "next-intl/routing";

export const locales = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "hi",
  "ar",
  "zh",
  "ja",
  "ko",
] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export const rtlLocales: AppLocale[] = ["ar"];

export const localeLabels: Record<AppLocale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  hi: "हिन्दी",
  ar: "العربية",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
};

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
  localeCookie: {
    name: LOCALE_COOKIE,
    maxAge: 60 * 60 * 24 * 365,
  },
});

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return Boolean(value && locales.includes(value as AppLocale));
}

export function isRtlLocale(locale: string): boolean {
  return rtlLocales.includes(locale as AppLocale);
}
