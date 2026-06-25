import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSettings } from "@/services/admin";
import type {
  EnqueueJobInput,
  JobHandler,
  JobProvider,
  JobPriority,
  QueueProvider,
} from "@/services/jobs/types";

const handlers = new Map<string, JobHandler>();

const priorityRank: Record<JobPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export class PrismaQueueProvider implements QueueProvider {
  async enqueue(input: EnqueueJobInput): Promise<string> {
    const row = await prisma.backgroundJob.create({
      data: {
        queue: input.queue,
        jobType: input.jobType,
        payload: input.payload as Prisma.InputJsonValue,
        runAt: input.runAt ?? input.scheduledAt ?? new Date(),
        scheduledAt: input.scheduledAt ?? null,
        maxAttempts: input.maxAttempts ?? 3,
        priority: input.priority ?? "normal",
      },
    });
    return row.id;
  }
}

export class InProcessJobProvider implements JobProvider {
  register(jobType: string, handler: JobHandler) {
    handlers.set(jobType, handler);
  }

  async processNext(queue?: string): Promise<boolean> {
    const pending = await prisma.backgroundJob.findMany({
      where: {
        status: "pending",
        runAt: { lte: new Date() },
        ...(queue ? { queue } : {}),
      },
      orderBy: [{ priority: "desc" }, { runAt: "asc" }],
      take: 20,
    });

    if (!pending.length) return false;

    const job = pending.sort(
      (a, b) =>
        priorityRank[b.priority as JobPriority] - priorityRank[a.priority as JobPriority] ||
        a.runAt.getTime() - b.runAt.getTime()
    )[0];

    const handler = handlers.get(job.jobType);
    if (!handler) {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "dead", lastError: `No handler for ${job.jobType}` },
      });
      return true;
    }

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: { status: "processing", lockedAt: new Date(), attempts: { increment: 1 } },
    });

    try {
      await handler(job.payload as Record<string, unknown>);
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "completed", completedAt: new Date(), lastError: null },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const failed = job.attempts + 1 >= job.maxAttempts;
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: failed ? "dead" : "pending",
          lastError: message,
          runAt: failed ? job.runAt : new Date(Date.now() + 30_000),
        },
      });
    }
    return true;
  }

  async processAllPending(limit = 10): Promise<number> {
    let processed = 0;
    for (let i = 0; i < limit; i++) {
      const ok = await this.processNext();
      if (!ok) break;
      processed++;
    }
    return processed;
  }
}

export const queueProvider: QueueProvider = new PrismaQueueProvider();
export const jobProvider: JobProvider = new InProcessJobProvider();

/** Enqueue or run inline based on admin feature flag. */
export async function enqueueOrRun(
  input: EnqueueJobInput,
  inline: () => Promise<void>
): Promise<void> {
  const settings = await getAdminSettings();
  if (settings.enableBackgroundJobs) {
    await queueProvider.enqueue(input);
    void jobProvider.processAllPending(3).catch((err) =>
      console.error("[jobs] process failed", err)
    );
    return;
  }
  await inline();
}
