import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { ServiceWorkerRegister } from "@/components/pwa/PwaShell";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { isAppLocale, isRtlLocale, locales } from "@/i18n/routing";
import { Toaster } from "react-hot-toast";

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = params;
  if (!isAppLocale(locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={isRtlLocale(locale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LanguageProvider initialLocale={locale}>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
              <ServiceWorkerRegister />
              {children}
              <CookieConsentBanner />
              <Toaster
                position="top-center"
                toastOptions={{
                  style: {
                    borderRadius: "9999px",
                    background: "rgb(var(--card))",
                    color: "rgb(var(--foreground))",
                    border: "1px solid rgb(var(--border))",
                  },
                }}
              />
            </ThemeProvider>
          </LanguageProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
