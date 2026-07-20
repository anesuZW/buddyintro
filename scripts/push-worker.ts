/**
 * Push notifications worker — BullMQ push-notifications queue.
 * Usage: npm run push-worker
 */
import fs from "fs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

const PUSH_QUEUE_NAME = "push-notifications";
const PUSH_DLQ_NAME = "push-notifications-dlq";

async function main() {
  if (!process.env.REDIS_URL) {
    console.error("REDIS_URL is required for push-worker");
    process.exit(1);
  }

  const { Worker, Queue } = await import("bullmq");
  const { deliverPushToUserDirect } = await import("@/services/notifications/push-service");
  const { recordWorkerHeartbeat } = await import("@/services/worker-status");
  const { appLogger } = await import("@/lib/logger");

  const dlq = new Queue(PUSH_DLQ_NAME, { connection: { url: process.env.REDIS_URL! } });

  const worker = new Worker(
    PUSH_QUEUE_NAME,
    async (job) => {
      await recordWorkerHeartbeat("push");
      const { userId, payload } = job.data as {
        userId: string;
        payload: Parameters<typeof deliverPushToUserDirect>[1];
      };
      await deliverPushToUserDirect(userId, payload);
    },
    {
      connection: { url: process.env.REDIS_URL! },
      concurrency: Number(process.env.PUSH_WORKER_CONCURRENCY ?? 10),
      limiter: { max: 120, duration: 60_000 },
    }
  );

  worker.on("failed", async (job, err) => {
    appLogger.error("push worker job failed", { jobId: job?.id, err });
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await dlq.add("push.dead", { ...job.data, error: err.message });
    }
  });

  setInterval(() => {
    void recordWorkerHeartbeat("push");
  }, 30_000);

  appLogger.info("push-notifications worker started", { route: "push-worker" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
