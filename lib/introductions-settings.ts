import "server-only";

import { cache } from "react";

import { getAdminSettings } from "@/services/admin";

/** Story expiry filter for introduction queries; empty when introductions never expire. */
export const getIntroductionExpiryFilter = cache(async (): Promise<
  { expiresAt: { gt: Date } } | Record<string, never>
> => {
  const settings = await getAdminSettings();
  if (settings.introductionsNeverExpire) return {};
  return { expiresAt: { gt: new Date() } };
});

export const introductionsNeverExpire = cache(async (): Promise<boolean> => {
  const settings = await getAdminSettings();
  return settings.introductionsNeverExpire;
});
