import "server-only";

import { monitorEventLoopDelay, type IntervalHistogram } from "perf_hooks";
import { getPerfSummary } from "@/lib/perf/store";
import {
  readRuntimeCounters,
  resetRuntimePrismaStats as resetCounters,
} from "@/lib/perf/runtime-counters";

export type RuntimeSnapshot = {
  ts: number;
  uptimeSec: number;
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    externalMb: number;
    arrayBuffersMb: number;
  };
  eventLoop: {
    lagMeanMs: number;
    lagMaxMs: number;
    lagP99Ms: number;
  };
  cpu: {
    userMs: number;
    systemMs: number;
    percent: number;
  };
  handles: {
    active: number;
    activeRequests: number;
  };
  prisma: {
    totalQueries: number;
    totalQueryMs: number;
    avgQueryMs: number;
    topQueries: Array<{ key: string; count: number; totalMs: number; avgMs: number }>;
  };
  auth: {
    avgMiddlewareMs: number;
    samples: number;
  };
  routes: ReturnType<typeof getPerfSummary>;
  pool: {
    connectionLimit: number | null;
    note: string;
  };
};

let loopMonitor: IntervalHistogram | null = null;
let lastCpu = process.cpuUsage();
let lastCpuAt = performance.now();

function ensureLoopMonitor(): IntervalHistogram {
  if (!loopMonitor) {
    loopMonitor = monitorEventLoopDelay({ resolution: 20 });
    loopMonitor.enable();
  }
  return loopMonitor;
}

function parseConnectionLimit(): number | null {
  const url = process.env.DATABASE_URL ?? "";
  const match = url.match(/connection_limit=(\d+)/i);
  return match ? Number(match[1]) : null;
}

function countActiveHandles(): number {
  const proc = process as NodeJS.Process & {
    _getActiveHandles?: () => unknown[];
  };
  return proc._getActiveHandles?.().length ?? 0;
}

export {
  incrementActiveRequests,
  decrementActiveRequests,
  recordRuntimePrismaQuery,
  recordRuntimeAuthMiddleware,
} from "@/lib/perf/runtime-counters";

export function resetRuntimePrismaStats(): void {
  resetCounters();
}

export function captureRuntimeSnapshot(): RuntimeSnapshot {
  const monitor = ensureLoopMonitor();
  const mem = process.memoryUsage();
  const now = performance.now();
  const cpuDelta = process.cpuUsage(lastCpu);
  const wallMs = now - lastCpuAt;
  lastCpu = process.cpuUsage();
  lastCpuAt = now;

  const cpuTotalMs = (cpuDelta.user + cpuDelta.system) / 1000;
  const cpuPercent = wallMs > 0 ? Math.round((cpuTotalMs / wallMs) * 1000) / 10 : 0;

  const lagMeanMs = Math.round((monitor.mean / 1e6) * 100) / 100;
  const lagMaxMs = Math.round((monitor.max / 1e6) * 100) / 100;
  const lagP99Ms = Math.round((monitor.percentile(99) / 1e6) * 100) / 100;
  monitor.reset();

  const counters = readRuntimeCounters();
  const limit = parseConnectionLimit();

  return {
    ts: Date.now(),
    uptimeSec: Math.round(process.uptime()),
    memory: {
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      externalMb: Math.round((mem.external / 1024 / 1024) * 10) / 10,
      arrayBuffersMb: Math.round((mem.arrayBuffers / 1024 / 1024) * 10) / 10,
    },
    eventLoop: {
      lagMeanMs,
      lagMaxMs,
      lagP99Ms,
    },
    cpu: {
      userMs: Math.round(cpuDelta.user / 1000),
      systemMs: Math.round(cpuDelta.system / 1000),
      percent: cpuPercent,
    },
    handles: {
      active: countActiveHandles(),
      activeRequests: counters.activeRequests,
    },
    prisma: {
      totalQueries: counters.totalPrismaQueries,
      totalQueryMs: counters.totalPrismaMs,
      avgQueryMs: counters.avgQueryMs,
      topQueries: counters.topQueries,
    },
    auth: {
      avgMiddlewareMs: counters.avgAuthMiddlewareMs,
      samples: counters.authMiddlewareSamples,
    },
    routes: getPerfSummary(),
    pool: {
      connectionLimit: limit,
      note: limit
        ? `Prisma connection_limit=${limit} from DATABASE_URL`
        : "No connection_limit in DATABASE_URL; pool size is driver default",
    },
  };
}
