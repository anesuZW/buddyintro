import "server-only";

import { prisma } from "@/lib/prisma";
import { listBlockedUserIds } from "@/services/moderation";

/** Search users by name or email (excluding self and blocked users). */
export async function searchUsers(query: string, excludeId: string, limit = 8) {
  const q = query.trim();
  if (!q) return [];

  const blockedIds = await listBlockedUserIds(excludeId);

  return prisma.user.findMany({
    where: {
      id: { not: excludeId, notIn: blockedIds },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, profilePicture: true },
    take: limit,
  });
}
