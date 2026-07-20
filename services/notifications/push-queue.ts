import "server-only";

import { prisma } from "@/lib/prisma";
import { enqueueOrRun } from "@/services/jobs/job-service";
import { JOB_TYPES, QUEUES } from "@/services/jobs/types";
import { sendWebPushToUser } from "@/services/notifications/notification-push";

const PUSH_QUEUE_NAME = "push-notifications";
const PUSH_DLQ_NAME = "push-notifications-dlq";

let bullQueue: import("bullmq").Queue | null | undefined;
let bullWorkerStarted = false;

export type PushJobPayload = {
  userId: string;
  title: string;
  body: string;
  url: string;
  type?: string;
};

async function getBullQueue(): Promise<import("bullmq").Queue | null> {
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
    new Queue(PUSH_DLQ_NAME, { connection: { url: redisUrl } });
    return bullQueue;
  } catch (err) {
    console.warn("[push-queue] BullMQ unavailable", err);
    bullQueue = null;
    return null;
  }
}

export async function enqueuePushNotification(payload: PushJobPayload) {
  const queue = await getBullQueue();
  if (queue) {
    await queue.add("push.send", payload, {
      jobId: `${payload.userId}:${payload.type || "generic"}:${Date.now()}`,
      removeOnComplete: true,
    });
    return;
  }

  await enqueueOrRun(
    {
      queue: QUEUES.NOTIFICATIONS,
      jobType: JOB_TYPES.PUSH_SEND,
      payload: payload as Record<string, unknown>,
    },
    async () => {
      await sendWebPushToUser(payload.userId, payload);
    }
  );
}

export async function startPushWorker() {
  if (bullWorkerStarted) return;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;

  const { Worker } = await import("bullmq");
  bullWorkerStarted = true;

  const worker = new Worker<PushJobPayload>(
    PUSH_QUEUE_NAME,
    async (job) => {
      await sendWebPushToUser(job.data.userId, job.data);
    },
    {
      connection: { url: redisUrl },
      concurrency: 5,
      limiter: { max: 60, duration: 60_000 },
    }
  );

  worker.on("failed", async (job, err) => {
    console.error("[push-worker] job failed", job?.id, err);
    if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
      const dlq = await getBullQueue();
      if (dlq) {
        await dlq.add("push.dlq", { ...job.data, error: String(err) });
      }
    }
  });

  console.log("[push-worker] started");
  return worker;
}

export async function savePushSubscriptionRecord(
  userId: string,
  sub: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
    deviceType?: string;
    browser?: string;
    platform?: string;
  }
) {
  const expirationTime =
    sub.expirationTime != null ? new Date(sub.expirationTime) : null;

  return prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      expirationTime,
      deviceType: sub.deviceType ?? null,
      browser: sub.browser ?? null,
      platform: sub.platform ?? null,
      enabled: true,
    },
    update: {
      userId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      expirationTime,
      deviceType: sub.deviceType ?? null,
      browser: sub.browser ?? null,
      platform: sub.platform ?? null,
      enabled: true,
      updatedAt: new Date(),
    },
  });
}

export async function disablePushSubscription(userId: string, endpoint: string) {
  return prisma.pushSubscription.updateMany({
    where: { userId, endpoint },
    data: { enabled: false, updatedAt: new Date() },
  });
}

export async function removePushSubscriptionRecord(userId: string, endpoint: string) {
  return prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export async function listPushSubscriptions(userId: string) {
  return prisma.pushSubscription.findMany({
    where: { userId, enabled: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function refreshExpiredSubscriptions() {
  const now = new Date();
  return prisma.pushSubscription.updateMany({
    where: { expirationTime: { lt: now }, enabled: true },
    data: { enabled: false },
  });
}
