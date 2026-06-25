import "server-only";

import { getAdminSettings } from "@/services/admin";

/** Story expiry filter for introduction queries; empty when introductions never expire. */
export async function getIntroductionExpiryFilter(): Promise<
  { expiresAt: { gt: Date } } | Record<string, never>
> {
  const settings = await getAdminSettings();
  if (settings.introductionsNeverExpire) return {};
  return { expiresAt: { gt: new Date() } };
}

export async function introductionsNeverExpire(): Promise<boolean> {
  const settings = await getAdminSettings();
  return settings.introductionsNeverExpire;
}
