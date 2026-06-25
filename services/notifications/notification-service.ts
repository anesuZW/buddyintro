import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { getAdminSettings } from "@/services/admin";
import { enqueueOrRun, jobProvider } from "@/services/jobs/job-service";
import { JOB_TYPES, QUEUES } from "@/services/jobs/types";
import "@/services/jobs/handlers";
import { sendNotificationEmail } from "@/services/notifications/notification-email";
import { sendWebPushToUser } from "@/services/notifications/notification-push";
import {
  getAdminCategoryField,
  getCategoryPrefField,
  NOTIFICATION_PRIORITY,
  notificationHref,
  NOTIFICATION_TYPES,
} from "@/lib/notification-types";
import type {
  CreateNotificationInput,
  NotificationListResult,
  NotificationQueue,
  UpdateNotificationPreferencesInput,
} from "@/services/notifications/types";

const userSelect = { id: true, name: true, profilePicture: true, email: true } as const;

async function getOrCreatePreferences(userId: string) {
  const existing = await prisma.notificationPreferences.findUnique({ where: { userId } });
  if (existing) return existing;

  try {
    return await prisma.notificationPreferences.create({ data: { userId } });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return prisma.notificationPreferences.findUniqueOrThrow({ where: { userId } });
    }
    throw error;
  }
}

function inQuietHours(prefs: {
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}) {
  if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) return false;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = prefs.quietHoursStart.split(":").map(Number);
  const [eh, em] = prefs.quietHoursEnd.split(":").map(Number);
  const start = sh * 60 + (sm || 0);
  const end = eh * 60 + (em || 0);
  if (start <= end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

async function shouldDeliver(
  userId: string,
  type: string,
  channel: "in_app" | "email" | "push"
): Promise<boolean> {
  const [settings, prefs] = await Promise.all([getAdminSettings(), getOrCreatePreferences(userId)]);
  if (!settings.enableNotifications || !prefs.enableNotifications) return false;
  if (inQuietHours(prefs) && channel !== "in_app") return false;

  const prefField = getCategoryPrefField(type);
  if (prefField && prefs[prefField as keyof typeof prefs] === false) return false;

  const adminField = getAdminCategoryField(type);
  if (adminField && settings[adminField as keyof typeof settings] === false) return false;

  if (type === NOTIFICATION_TYPES.INTRODUCTION_VIEWED && !settings.enableIntroductionViewNotifications) {
    return false;
  }

  if (channel === "in_app") {
    return settings.enableInAppNotifications && prefs.enableInAppNotifications;
  }
  if (channel === "email") {
    return settings.enableEmailNotifications && prefs.enableEmailNotifications;
  }
  if (channel === "push") {
    return settings.enablePushNotifications && prefs.enablePushNotifications;
  }
  return true;
}

export class PrismaNotificationQueue implements NotificationQueue {
  async enqueue(payload: CreateNotificationInput): Promise<void> {
    await enqueueOrRun(
      {
        queue: QUEUES.NOTIFICATIONS,
        jobType: JOB_TYPES.NOTIFICATION_DELIVER,
        payload: payload as Record<string, unknown>,
      },
      async () => {
        await notificationService.create(payload);
      }
    );
  }
}

export const notificationQueue: NotificationQueue = new PrismaNotificationQueue();

export const notificationService = {
  async create(input: CreateNotificationInput) {
    if (input.actorId && input.userId === input.actorId) return null;

    const [deliverInApp, deliverEmail, deliverPush] = await Promise.all([
      shouldDeliver(input.userId, input.type, "in_app"),
      !input.skipEmail && shouldDeliver(input.userId, input.type, "email"),
      !input.skipPush && shouldDeliver(input.userId, input.type, "push"),
    ]);

    let notification = null;
    if (deliverInApp) {
      notification = await prisma.notification.create({
        data: {
          userId: input.userId,
          actorId: input.actorId ?? null,
          type: input.type,
          title: input.title,
          message: input.message,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
        },
        include: { actor: { select: userSelect } },
      });
    }

    if (deliverEmail) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, name: true },
      });
      if (user?.email) {
        void sendNotificationEmail({
          to: user.email,
          name: user.name,
          title: input.title,
          message: input.message,
          href: notificationHref(input.entityType, input.entityId, input.actorId),
        }).catch((err) => console.error("[notifications] email failed", err));
      }
    }

    if (deliverPush) {
      void sendWebPushToUser(input.userId, {
        title: input.title,
        body: input.message,
        url: notificationHref(input.entityType, input.entityId, input.actorId),
      }).catch((err) => console.error("[notifications] push failed", err));
    }

    return notification;
  },

  async list(args: {
    userId: string;
    cursor?: string;
    limit?: number;
    type?: string;
    unreadOnly?: boolean;
  }): Promise<NotificationListResult> {
    const limit = args.limit ?? 20;
    const where = {
      userId: args.userId,
      ...(args.type ? { type: args.type } : {}),
      ...(args.unreadOnly ? { isRead: false } : {}),
      ...(args.cursor ? { createdAt: { lt: new Date(args.cursor) } } : {}),
    };

    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        include: { actor: { select: userSelect } },
      }),
      prisma.notification.count({ where: { userId: args.userId, isRead: false } }),
    ]);

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    const items = slice
      .map((n) => ({
        id: n.id,
        userId: n.userId,
        actorId: n.actorId,
        type: n.type,
        title: n.title,
        message: n.message,
        entityType: n.entityType,
        entityId: n.entityId,
        isRead: n.isRead,
        readAt: n.readAt,
        createdAt: n.createdAt,
        actor: n.actor,
        href: notificationHref(n.entityType, n.entityId, n.actorId),
        priority: NOTIFICATION_PRIORITY[n.type] ?? 50,
      }))
      .sort((a, b) => a.priority - b.priority || b.createdAt.getTime() - a.createdAt.getTime());

    return {
      items,
      nextCursor: hasMore ? slice[slice.length - 1].createdAt.toISOString() : null,
      unreadCount,
    };
  },

  async markRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async delete(userId: string, notificationId: string) {
    return prisma.notification.deleteMany({ where: { id: notificationId, userId } });
  },

  async unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  async getPreferences(userId: string) {
    return getOrCreatePreferences(userId);
  },

  async updatePreferences(userId: string, input: UpdateNotificationPreferencesInput) {
    const existing = await prisma.notificationPreferences.findUnique({ where: { userId } });
    if (existing) {
      return prisma.notificationPreferences.update({ where: { userId }, data: input });
    }

    try {
      return await prisma.notificationPreferences.create({ data: { userId, ...input } });
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        return prisma.notificationPreferences.update({ where: { userId }, data: input });
      }
      throw error;
    }
  },

  async savePushSubscription(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } }
  ) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
  },

  async removePushSubscription(userId: string, endpoint: string) {
    return prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  },

  async broadcastAnnouncement(args: { title: string; message: string; type?: string }) {
    const settings = await getAdminSettings();
    const run = async () => {
      const users = await prisma.user.findMany({ select: { id: true } });
      await Promise.all(
        users.map((u) =>
          notificationQueue.enqueue({
            userId: u.id,
            type: args.type ?? "admin_announcement",
            title: args.title,
            message: args.message,
          })
        )
      );
    };
    if (settings.enableBackgroundJobs) {
      await enqueueOrRun(
        {
          queue: QUEUES.NOTIFICATIONS,
          jobType: JOB_TYPES.ADMIN_BROADCAST,
          payload: args as Record<string, unknown>,
        },
        run
      );
      void jobProvider.processAllPending(5).catch(() => {});
      return;
    }
    await run();
  },
};

export async function getUnreadNotificationCount(userId: string) {
  return notificationService.unreadCount(userId);
}
