import "server-only";

import { prisma } from "@/lib/prisma";
import { getAdminSettings } from "@/services/admin";
import { invalidateIntroductionCategoriesCache, listIntroductionCategoriesCached } from "@/lib/perf-cache";

export async function listIntroductionCategories(activeOnly = true) {
  return listIntroductionCategoriesCached(activeOnly);
}

export async function createIntroductionCategory(args: {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isSystem?: boolean;
  createdByUserId?: string;
}) {
  const row = await prisma.introductionCategory.create({ data: args });
  invalidateIntroductionCategoriesCache();
  return row;
}

export async function updateIntroductionCategory(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    isActive: boolean;
  }>
) {
  const row = await prisma.introductionCategory.update({ where: { id }, data });
  invalidateIntroductionCategoriesCache();
  return row;
}

export async function deleteIntroductionCategory(id: string) {
  const row = await prisma.introductionCategory.update({
    where: { id },
    data: { isActive: false },
  });
  invalidateIntroductionCategoriesCache();
  return row;
}

export async function createUserCategory(args: {
  userId: string;
  name: string;
  description?: string;
}) {
  const settings = await getAdminSettings();
  if (!settings.allowUserCreatedCategories) {
    throw new Error("User-created categories are disabled");
  }
  return createIntroductionCategory({
    name: args.name,
    description: args.description,
    createdByUserId: args.userId,
    isSystem: false,
  });
}
