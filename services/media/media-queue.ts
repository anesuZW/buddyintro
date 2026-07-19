import "server-only";



import type { MediaProcessJobPayload } from "@/lib/storage/types";

import { queueProvider } from "@/services/jobs/job-service";

import { JOB_TYPES, QUEUES } from "@/services/jobs/types";

import { recordWorkerJob } from "@/lib/metrics";



const MEDIA_QUEUE_NAME = "media-processing";

const MEDIA_DLQ_NAME = "media-processing-dlq";

const PROGRESS_PREFIX = "media:progress:";



let bullQueue: import("bullmq").Queue | null | undefined;

let bullDlq: import("bullmq").Queue | null | undefined;



async function getBullQueue(): Promise<import("bullmq").Queue | null> {

  if (bullQueue !== undefined) return bullQueue;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {

    bullQueue = null;

    return null;

  }



  try {

    const { Queue } = await import("bullmq");

    bullQueue = new Queue(MEDIA_QUEUE_NAME, {

      connection: { url: redisUrl },

      defaultJobOptions: {

        attempts: 5,

        backoff: { type: "exponential", delay: 5000 },

        removeOnComplete: 500,

        removeOnFail: false,

      },

    });

    bullDlq = new Queue(MEDIA_DLQ_NAME, { connection: { url: redisUrl } });

    return bullQueue;

  } catch (err) {

    const { appLogger } = await import("@/lib/logger");

    appLogger.warn("BullMQ unavailable — falling back to Prisma queue", { err });

    bullQueue = null;

    return null;

  }

}



export async function setMediaJobProgress(mediaObjectId: string, progress: number, stage: string) {

  const { getRedis } = await import("@/lib/redis");

  const redis = await getRedis();

  const payload = JSON.stringify({ progress, stage, at: new Date().toISOString() });

  if (redis) await redis.setex(`${PROGRESS_PREFIX}${mediaObjectId}`, 3600, payload);

}



export async function getMediaJobProgress(mediaObjectId: string) {

  const { getRedis } = await import("@/lib/redis");

  const redis = await getRedis();

  if (!redis) return null;

  const raw = await redis.get(`${PROGRESS_PREFIX}${mediaObjectId}`);

  return raw ? (JSON.parse(raw) as { progress: number; stage: string; at: string }) : null;

}



/** Idempotent media processing enqueue — BullMQ when REDIS_URL is set, else Prisma jobs. */

export async function enqueueMediaProcess(

  payload: MediaProcessJobPayload,

  options?: { priority?: number }

): Promise<string> {

  const queue = await getBullQueue();

  if (queue) {

    const job = await queue.add(JOB_TYPES.MEDIA_PROCESS, payload, {

      jobId: `media:${payload.mediaObjectId}`,

      priority: options?.priority ?? 1,

    });

    recordWorkerJob(MEDIA_QUEUE_NAME, "enqueued");

    return String(job.id);

  }



  return queueProvider.enqueue({

    queue: QUEUES.MEDIA,

    jobType: JOB_TYPES.MEDIA_PROCESS,

    payload,

    priority: "high",

    maxAttempts: 5,

  });

}



export async function enqueueMediaCleanup(payload: { dryRun?: boolean; maxAgeHours?: number } = {}) {

  const queue = await getBullQueue();

  if (queue) {

    const job = await queue.add(JOB_TYPES.MEDIA_CLEANUP, payload, {

      jobId: `media-cleanup:${new Date().toISOString().slice(0, 10)}`,

      priority: 10,

    });

    return String(job.id);

  }



  return queueProvider.enqueue({

    queue: QUEUES.MEDIA,

    jobType: JOB_TYPES.MEDIA_CLEANUP,

    payload,

    priority: "low",

    scheduledAt: new Date(),

  });

}



export async function moveJobToDeadLetter(jobId: string, payload: unknown, error: string) {

  const dlq = bullDlq ?? (await getBullQueue() ? bullDlq : null);

  if (dlq) {

    await dlq.add("media.dead", { jobId, payload, error, at: new Date().toISOString() });

    recordWorkerJob(MEDIA_DLQ_NAME, "dead");

  }

}



export { MEDIA_QUEUE_NAME, MEDIA_DLQ_NAME };


