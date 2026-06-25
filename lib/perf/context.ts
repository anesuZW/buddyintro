import "server-only";

import { AsyncLocalStorage } from "async_hooks";
import type { SlowQueryRecord } from "@/lib/perf/store";
import { recordPerf, recordSlowQuery } from "@/lib/perf/store";
import {
  decrementActiveRequests,
  incrementActiveRequests,
  recordRuntimePrismaQuery,
} from "@/lib/perf/runtime-metrics";
import {
  finishAuthRouteProfile,
  isAuthProfileEnabled,
  readAuthProfileMetrics,
  runWithAuthProfile,
} from "@/lib/auth-profile";
import { recordPhase2PrismaQuery } from "@/lib/profile/phase2-profiler";
import {
  isProductionBenchmarkEnabled,
  stashPageBenchmarkMetrics,
} from "@/lib/profile/production-benchmark";

export type PerfContext = {
  label: string;
  kind: "route" | "api" | "page";
  method?: string;
  startedAt: number;
  queryCount: number;
  prismaTotalMs: number;
  slowQueries: SlowQueryRecord[];
};

const perfStorage = new AsyncLocalStorage<PerfContext>();

export function runWithPerf<T>(
  meta: Pick<PerfContext, "label" | "kind" | "method">,
  fn: () => Promise<T>
): Promise<T> {
  const ctx: PerfContext = {
    ...meta,
    startedAt: performance.now(),
    queryCount: 0,
    prismaTotalMs: 0,
    slowQueries: [],
  };
  return perfStorage.run(ctx, async () => {
    incrementActiveRequests();
    const run = async () => {
      try {
        return await fn();
      } finally {
        decrementActiveRequests();
        const durationMs = Math.round(performance.now() - ctx.startedAt);
        recordPerf({
          kind: ctx.kind,
          label: ctx.label,
          method: ctx.method,
          durationMs,
          queryCount: ctx.queryCount,
          slowQueries: [...ctx.slowQueries],
        });
        if (isAuthProfileEnabled() && ctx.kind === "page") {
          finishAuthRouteProfile({
            route: ctx.label,
            totalMs: durationMs,
          });
        }
        if (isProductionBenchmarkEnabled() && ctx.kind === "page") {
          const auth = readAuthProfileMetrics();
          if (auth.requestId) {
            stashPageBenchmarkMetrics({
              requestId: auth.requestId,
              route: ctx.label,
              totalMs: durationMs,
              prismaMs: Math.max(ctx.prismaTotalMs, auth.prismaMs),
              queryCount: ctx.queryCount,
            });
          }
        }
      }
    };
    return isAuthProfileEnabled() ? runWithAuthProfile(run) : run();
  });
}

export function getPerfContext(): PerfContext | undefined {
  return perfStorage.getStore();
}

/** Called from Prisma extension — tracks query count and slow queries per request. */
export function trackPrismaQuery(model: string, action: string, durationMs: number) {
  if (isProductionBenchmarkEnabled()) {
    recordRuntimePrismaQuery(model, action, durationMs);
  }

  const ctx = perfStorage.getStore();
  if (ctx) {
    ctx.queryCount += 1;
    ctx.prismaTotalMs += durationMs;
    if (durationMs > 200) {
      const rec = { model, action, durationMs, timestamp: Date.now() };
      ctx.slowQueries.push(rec);
      recordSlowQuery(rec);
    }
  }

  if (
    process.env.PROFILE_API === "1" ||
    process.env.PROFILE_PHASE2 === "1" ||
    process.env.PROFILE_PRODUCTION === "1"
  ) {
    recordPhase2PrismaQuery(model, action, durationMs);
  }
}
