/**
 * Background job worker — polls Prisma queue and processes registered handlers.
 * Usage: npm run job-worker
 *
 * Designed for a standalone process (cron, systemd, or container).
 * Future Redis/BullMQ migration can replace the queue provider without changing handlers.
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

async function main() {
  const { jobProvider } = await import("@/services/jobs/job-service");
  await import("@/services/jobs/handlers");

  const intervalMs = Number(process.env.JOB_WORKER_INTERVAL_MS ?? 5000);
  const batchSize = Number(process.env.JOB_WORKER_BATCH_SIZE ?? 10);
  const queue = process.env.JOB_WORKER_QUEUE;

  console.info(
    `[job-worker] started interval=${intervalMs}ms batch=${batchSize}${queue ? ` queue=${queue}` : ""}`
  );

  const tick = async () => {
    try {
      let processed = 0;
      for (let i = 0; i < batchSize; i++) {
        const ok = await jobProvider.processNext(queue || undefined);
        if (!ok) break;
        processed++;
      }
      if (processed > 0) {
        console.info(`[job-worker] processed ${processed} job(s)`);
      }
    } catch (err) {
      console.error("[job-worker] tick failed", err);
    }
  };

  await tick();
  setInterval(tick, intervalMs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
