import "@/styles/globals.css";

import type { Metadata, Viewport } from "next";

import { ThemeProvider } from "@/components/providers/ThemeProvider";

import { Toaster } from "react-hot-toast";

import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";

import { ServiceWorkerRegister } from "@/components/pwa/PwaShell";

import { BRAND, BRAND_URL } from "@/lib/branding";
import { COPY } from "@/lib/copy";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_URL),
  title: {
    default: `${BRAND.name} — trusted introductions`,
    template: `%s · ${BRAND.name}`,
  },
  description: COPY.appDescription,
  applicationName: BRAND.name,
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: BRAND.name,
    description: BRAND.tagline,
    url: BRAND_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: BRAND.tagline,
  },
  icons: {
    icon: "/icons/icon-512.svg",
    apple: "/icons/apple-icon-180.svg",
  },
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
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
      </body>
    </html>
  );
}
