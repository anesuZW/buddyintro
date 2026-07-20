import { prisma } from "@/lib/prisma";
import { isValidPushEndpoint } from "@/lib/pwa/push-payload";
import type { PushSubscribeInput } from "@/lib/pwa/push-schemas";

export const pushSubscriptionService = {
  async listForUser(userId: string) {
    return prisma.pushSubscription.findMany({
      where: { userId, enabled: true },
      orderBy: { updatedAt: "desc" },
    });
  },

  async save(userId: string, input: PushSubscribeInput) {
    if (!isValidPushEndpoint(input.endpoint)) {
      throw new Error("Invalid push endpoint");
    }

    const expirationTime =
      input.expirationTime != null ? new Date(input.expirationTime) : null;

    return prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        expirationTime,
        deviceType: input.deviceType ?? null,
        browser: input.browser ?? null,
        platform: input.platform ?? null,
        enabled: true,
        lastUsedAt: new Date(),
      },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        expirationTime,
        deviceType: input.deviceType ?? null,
        browser: input.browser ?? null,
        platform: input.platform ?? null,
        enabled: true,
        lastUsedAt: new Date(),
      },
    });
  },

  async remove(userId: string, endpoint: string) {
    return prisma.pushSubscription.updateMany({
      where: { userId, endpoint },
      data: { enabled: false },
    });
  },

  async disableAllForUser(userId: string) {
    return prisma.pushSubscription.updateMany({
      where: { userId },
      data: { enabled: false },
    });
  },

  async refreshSubscription(userId: string, oldEndpoint: string, input: PushSubscribeInput) {
    await prisma.pushSubscription.updateMany({
      where: { userId, endpoint: oldEndpoint },
      data: { enabled: false },
    });
    return this.save(userId, input);
  },
};
