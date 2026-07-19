/**
 * Media background worker — BullMQ when REDIS_URL is set, otherwise Prisma job polling.
 * Usage: npm run media-worker
 */
import fs from "fs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

async function startBullWorker() {
  const { Worker } = await import("bullmq");
  const { MEDIA_QUEUE_NAME, moveJobToDeadLetter } = await import("@/services/media/media-queue");
  const { JOB_TYPES } = await import("@/services/jobs/types");
  const { processMediaObject } = await import("@/services/media/media-processor");
  const { runMediaCleanup } = await import("@/services/media/media-cleanup");
  const { recordWorkerHeartbeat } = await import("@/services/worker-status");
  const { appLogger } = await import("@/lib/logger");
  const { recordWorkerJob } = await import("@/lib/metrics");

  const worker = new Worker(
    MEDIA_QUEUE_NAME,
    async (job) => {
      await recordWorkerHeartbeat("media");
      if (job.name === JOB_TYPES.MEDIA_PROCESS) {
        await processMediaObject({
          mediaObjectId: String(job.data.mediaObjectId),
          storagePath: String(job.data.storagePath),
          kind: job.data.kind as "image" | "video" | "audio",
        });
        recordWorkerJob(MEDIA_QUEUE_NAME, "completed");
        return;
      }
      if (job.name === JOB_TYPES.MEDIA_CLEANUP) {
        await runMediaCleanup({
          dryRun: Boolean(job.data.dryRun),
          maxAgeHours: job.data.maxAgeHours ? Number(job.data.maxAgeHours) : undefined,
        });
        recordWorkerJob(MEDIA_QUEUE_NAME, "completed");
      }
    },
    {
      connection: { url: process.env.REDIS_URL! },
      concurrency: Number(process.env.MEDIA_WORKER_CONCURRENCY ?? 2),
    }
  );

  worker.on("failed", async (job, err) => {
    appLogger.error("media worker job failed", {
      route: "media-worker",
      err,
      jobId: job?.id,
    });
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await moveJobToDeadLetter(String(job.id), job.data, err.message);
      recordWorkerJob(MEDIA_QUEUE_NAME, "dead");
    } else {
      recordWorkerJob(MEDIA_QUEUE_NAME, "failed");
    }
  });

  setInterval(() => {
    void recordWorkerHeartbeat("media");
  }, 30_000);

  appLogger.info("BullMQ media worker started", { route: "media-worker" });
  return worker;
}

async function startPrismaPoller() {
  const { jobProvider } = await import("@/services/jobs/job-service");
  await import("@/services/jobs/handlers");
  const { recordWorkerHeartbeat } = await import("@/services/worker-status");
  const { appLogger } = await import("@/lib/logger");

  const intervalMs = Number(process.env.MEDIA_WORKER_INTERVAL_MS ?? 3000);
  const batchSize = Number(process.env.MEDIA_WORKER_BATCH_SIZE ?? 5);

  appLogger.info("Prisma media poller started", { route: "media-worker", intervalMs });

  const tick = async () => {
    try {
      await recordWorkerHeartbeat("media");
      for (let i = 0; i < batchSize; i++) {
        const ok = await jobProvider.processNext("media");
        if (!ok) break;
      }
    } catch (err) {
      appLogger.error("media worker tick failed", { route: "media-worker", err });
    }
  };

  await tick();
  setInterval(tick, intervalMs);
}

async function main() {
  if (process.env.REDIS_URL) {
    await startBullWorker();
    return;
  }
  await startPrismaPoller();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
