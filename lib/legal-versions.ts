export const LEGAL_VERSIONS = {
  privacy: process.env.LEGAL_PRIVACY_VERSION || "2026-05-24",
  terms: process.env.LEGAL_TERMS_VERSION || "2026-05-24",
  cookies: process.env.LEGAL_COOKIES_VERSION || "2026-05-24",
} as const;

export const LEGAL_ENTITY = {
  name: process.env.LEGAL_ENTITY_NAME || "[INSERT LEGAL ENTITY NAME]",
  address: process.env.LEGAL_ENTITY_ADDRESS || "[INSERT COMPANY ADDRESS]",
  supportEmail: process.env.LEGAL_SUPPORT_EMAIL || "[INSERT SUPPORT EMAIL]",
} as const;
