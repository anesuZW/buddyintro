import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getAdminSettings } from "@/services/admin";
import type { TrustRecommendation } from "@/services/trust-recommendations";

const RECS_TTL_MS = 5 * 60_000;
const recsCache = new Map<string, { value: TrustRecommendation[]; expires: number }>();

/** In-memory cache for trust recommendations — avoids repeated 7s+ API work per session. */
export async function getCachedTrustRecommendations(
  userId: string,
  compute: () => Promise<TrustRecommendation[]>
): Promise<TrustRecommendation[]> {
  const now = Date.now();
  const hit = recsCache.get(userId);
  if (hit && hit.expires > now) return hit.value;

  const value = await compute();
  recsCache.set(userId, { value, expires: now + RECS_TTL_MS });
  return value;
}

export function invalidateTrustRecommendationsCache(userId?: string) {
  if (userId) recsCache.delete(userId);
  else recsCache.clear();
}

/** Cached category list — categories change rarely. */
const CATEGORY_TTL_MS = 5 * 60_000;
let categoriesCache: {
  activeOnly: boolean;
  value: Awaited<ReturnType<typeof loadCategories>>;
  expires: number;
} | null = null;

async function loadCategories(activeOnly: boolean) {
  const settings = await getAdminSettings();
  if (!settings.enableIntroductionCategories) return [];
  return prisma.introductionCategory.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

export const listIntroductionCategoriesCached = cache(async (activeOnly = true) => {
  const now = Date.now();
  if (
    categoriesCache &&
    categoriesCache.activeOnly === activeOnly &&
    categoriesCache.expires > now
  ) {
    return categoriesCache.value;
  }
  const value = await loadCategories(activeOnly);
  categoriesCache = { activeOnly, value, expires: now + CATEGORY_TTL_MS };
  return value;
});

export function invalidateIntroductionCategoriesCache() {
  categoriesCache = null;
}
