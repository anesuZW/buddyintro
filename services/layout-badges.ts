import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getIntroductionExpiryFilter } from "@/lib/introductions-settings";
import { getUnreadNotificationCount } from "@/services/notifications/notification-service";

/** Combined layout badge queries — request-scoped dedupe via userId. */
export const getLayoutBadges = cache(
  async (user: { id: string; lastIntroductionsSeenAt: Date | null }) => {
    const expiryFilter = await getIntroductionExpiryFilter();
    const lastSeen = user.lastIntroductionsSeenAt;

    const [introBadge, unreadMessages, unreadNotifications] = await Promise.all([
      prisma.story.count({
        where: {
          ...expiryFilter,
          tags: { some: { taggedUserId: user.id } },
          ...(lastSeen ? { createdAt: { gt: lastSeen } } : {}),
        },
      }),
      prisma.message.count({
        where: { receiverId: user.id, readAt: null },
      }),
      getUnreadNotificationCount(user.id),
    ]);

    return { introBadge, unreadMessages, unreadNotifications };
  }
);
