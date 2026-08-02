import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getIntroductionExpiryFilter } from "@/lib/introductions-settings";
import { getUnreadNotificationCount } from "@/services/notifications/notification-service";

/** Combined layout badge queries — request-scoped dedupe via primitive userId key. */
export const getLayoutBadges = cache(
  async (userId: string, lastIntroductionsSeenAt: Date | null) => {
    try {
      const expiryFilter = await getIntroductionExpiryFilter();
      const lastSeen = lastIntroductionsSeenAt;

      const [introBadge, unreadMessages, unreadNotifications] = await Promise.all([
        prisma.story.count({
          where: {
            ...expiryFilter,
            tags: { some: { taggedUserId: userId } },
            ...(lastSeen ? { createdAt: { gt: lastSeen } } : {}),
          },
        }),
        prisma.message.count({
          where: { receiverId: userId, readAt: null },
        }),
        getUnreadNotificationCount(userId),
      ]);

      return { introBadge, unreadMessages, unreadNotifications };
    } catch (err) {
      // Badges must never crash authenticated shells (pooler blips → blank Application error).
      console.warn("[layout-badges] degraded", err instanceof Error ? err.message : err);
      return { introBadge: 0, unreadMessages: 0, unreadNotifications: 0 };
    }
  }
);
