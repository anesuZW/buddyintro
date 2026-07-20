import "server-only";

import { prisma } from "@/lib/prisma";
import { MEDIA_QUEUE_NAME } from "@/services/media/media-queue";

export type WorkerStatusSnapshot = {
  healthy: boolean;
  lastHeartbeat: string | null;
  media: {
    pending: number;
    processing: number;
    failed: number;
    deadLetter: number;
  };
  prismaQueue: Record<string, number>;
  bullmq?: {
    waiting: number;
    active: number;
    failed: number;
    delayed: number;
  };
};

const HEARTBEAT_KEY = "worker:heartbeat";

export async function recordWorkerHeartbeat(source: "media" | "jobs" | "push" = "media"): Promise<void> {
  const { getRedis } = await import("@/lib/redis");
  const redis = await getRedis();
  const payload = JSON.stringify({ source, at: new Date().toISOString() });
  if (redis) {
    await redis.setex(`${HEARTBEAT_KEY}:${source}`, 120, payload);
    return;
  }
}

export async function getWorkerStatus(): Promise<WorkerStatusSnapshot> {
  const { getRedis } = await import("@/lib/redis");
  const redis = await getRedis();
  let lastHeartbeat: string | null = null;
  if (redis) {
    const media = await redis.get(`${HEARTBEAT_KEY}:media`);
    const jobs = await redis.get(`${HEARTBEAT_KEY}:jobs`);
    lastHeartbeat = media || jobs;
    if (media) {
      try {
        lastHeartbeat = (JSON.parse(media) as { at: string }).at;
      } catch {
        /* ignore */
      }
    }
  }

  const [pending, processing, failed, deadLetter] = await Promise.all([
    prisma.backgroundJob.count({ where: { queue: "media", status: "pending" } }),
    prisma.backgroundJob.count({ where: { queue: "media", status: "processing" } }),
    prisma.backgroundJob.count({ where: { queue: "media", status: "failed" } }),
    prisma.backgroundJob.count({ where: { queue: "media", status: "dead" } }),
  ]);

  const grouped = await prisma.backgroundJob.groupBy({
    by: ["status"],
    _count: true,
  });
  const prismaQueue = Object.fromEntries(grouped.map((g) => [g.status, g._count]));

  let bullmq: WorkerStatusSnapshot["bullmq"];
  if (redis) {
    try {
      const { Queue } = await import("bullmq");
      const queue = new Queue(MEDIA_QUEUE_NAME, { connection: { url: process.env.REDIS_URL! } });
      const counts = await queue.getJobCounts("waiting", "active", "failed", "delayed");
      bullmq = {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
      };
      await queue.close();
    } catch {
      /* optional */
    }
  }

  const healthy =
    deadLetter < 50 &&
    (!lastHeartbeat || Date.now() - new Date(lastHeartbeat).getTime() < 5 * 60 * 1000);

  return {
    healthy,
    lastHeartbeat,
    media: { pending, processing, failed, deadLetter },
    prismaQueue,
    bullmq,
  };
}
