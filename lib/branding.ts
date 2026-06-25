export const BRAND = {
  name: "BuddyIntro",
  tagline: "Discover trusted people through people you already trust",
  shortName: "Buddy",
  domain: "buddyintro.com",
} as const;

/** Logo monogram in nav, emails, etc. (e.g. FI → BI). */
export const BRAND_INITIALS = `${BRAND.name.charAt(0)}I`;

export const BRAND_URL =
  process.env.NEXT_PUBLIC_APP_URL || `https://${BRAND.domain}`;

export const BRAND_SUPPORT_EMAIL =
  process.env.LEGAL_SUPPORT_EMAIL || `support@${BRAND.domain}`;

export const BRAND_NOTIFICATIONS_EMAIL =
  process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ||
  process.env.RESEND_FROM?.match(/<([^>]+)>/)?.[1] ||
  `notifications@${BRAND.domain}`;

export const BRAND_INVITES_EMAIL =
  process.env.INVITES_FROM?.match(/<([^>]+)>/)?.[1] ||
  `invites@${BRAND.domain}`;

/** Resend-ready From header when RESEND_API_KEY + EMAIL_FROM are set. */
export const BRAND_EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.RESEND_FROM ||
  (process.env.RESEND_API_KEY
    ? `${BRAND.name} <${BRAND_NOTIFICATIONS_EMAIL}>`
    : `${BRAND.name} <${BRAND_INVITES_EMAIL}>`);
