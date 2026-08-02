"use client";

import dynamic from "next/dynamic";

/** Deferred — consent UI is below the fold and unused after first choice. */
export const LazyCookieConsentBanner = dynamic(
  () =>
    import("@/components/legal/CookieConsentBanner").then(
      (m) => m.CookieConsentBanner
    ),
  { ssr: false }
);
