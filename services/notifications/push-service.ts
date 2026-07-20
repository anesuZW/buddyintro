import "server-only";

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { BRAND_SUPPORT_EMAIL } from "@/lib/branding";
import { getAdminSettings } from "@/services/admin";
import { isValidPushEndpoint, sanitizePushPayload, type PushPayload } from "@/lib/pwa/push-payload";

const PUSH_QUEUE_NAME = "push-notifications";

let bullQueue: import("bullmq").Queue | null | undefined;

function configureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || `mailto:${BRAND_SUPPORT_EMAIL}`;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function getPushQueue(): Promise<import("bullmq").Queue | null> {
  if (bullQueue !== undefined) return bullQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    bullQueue = null;
    return null;
  }
  try {
    const { Queue } = await import("bullmq");
    bullQueue = new Queue(PUSH_QUEUE_NAME, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 1000,
        removeOnFail: false,
      },
    });
    return bullQueue;
  } catch {
    bullQueue = null;
    return null;
  }
}

export async function deliverPushToUserDirect(userId: string, payload: PushPayload) {
  if (!configureVapid()) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId, enabled: true },
  });
  if (!subs.length) return;

  const body = JSON.stringify(sanitizePushPayload(payload));
  const now = new Date();

  await Promise.all(
    subs.map(async (sub) => {
      if (!isValidPushEndpoint(sub.endpoint)) {
        await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } });
        return;
      }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        await prisma.pushSubscription.update({
          where: { endpoint: sub.endpoint },
          data: { lastUsedAt: now },
        });
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } });
        } else {
          throw err;
        }
      }
    })
  );
}

export async function enqueuePushNotification(userId: string, payload: PushPayload) {
  const settings = await getAdminSettings();
  if (!settings.enablePushNotifications) return;

  const safe = sanitizePushPayload(payload);
  const queue = await getPushQueue();
  if (queue) {
    await queue.add("push.send", { userId, payload: safe });
    return;
  }

  await deliverPushToUserDirect(userId, safe);
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  return enqueuePushNotification(userId, payload);
}

export async function sendTestPush(userId: string) {
  await sendPushToUser(userId, {
    title: "BuddyIntro",
    body: "Push notifications are working.",
    url: "/notifications",
    tag: "test",
    type: "system_alert",
  });
}

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

/** @deprecated Worker runs via scripts/push-worker.ts */
export async function startPushWorker() {
  /* no-op — use npm run push-worker */
}
