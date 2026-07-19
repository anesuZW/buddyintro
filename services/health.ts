import "server-only";

import { promisify } from "util";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/constants";
import { getMediaRoot } from "@/lib/storage/config";
import { getStorageProvider } from "@/lib/storage/index";
import { isUserConnectionsMaterialized } from "@/services/introduction-graph-builder";
import { isRedisConfigured } from "@/lib/redis";
import { setGauge } from "@/lib/metrics";
import { getWorkerStatus } from "@/services/worker-status";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type HealthCheckResult = {
  status: HealthStatus;
  database: HealthStatus;
  storage: HealthStatus;
  queue: HealthStatus;
  analytics: HealthStatus;
  graph: HealthStatus;
  redis: HealthStatus;
  worker: HealthStatus;
  details: Record<string, string | number | boolean>;
  checkedAt: string;
};

export type ProductionHealthSummary = {
  status: HealthStatus;
  database: HealthStatus;
  supabase: HealthStatus;
  redis: HealthStatus;
  storage: HealthStatus;
  queue: HealthStatus;
  worker: HealthStatus;
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    externalMb: number;
  };
  disk?: {
    totalGb: number;
    freeGb: number;
    usedPercent: number;
  };
  uptime: number;
  nodeVersion: string;
  buildVersion?: string;
  gitCommit?: string;
  activeUsers24h?: number;
  websocketConnections: number;
  checkedAt: string;
  requestId?: string;
  deployment?: {
    version: string;
    gitCommit: string;
    gitBranch: string;
    deploymentId?: string;
    buildDate: string;
  };
  details?: Record<string, string | number | boolean>;
};

async function measureDatabaseLatency(): Promise<{ status: HealthStatus; latencyMs?: number; error?: string }> {
  try {
    const start = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - start);
    return { status: latencyMs > 500 ? "degraded" : "healthy", latencyMs };
  } catch (err) {
    return { status: "unhealthy", error: err instanceof Error ? err.message : String(err) };
  }
}

async function measureDiskUsage(): Promise<{ totalGb: number; freeGb: number; usedPercent: number } | null> {
  try {
    const { statfs } = await import("fs");
    const statfsPromise = promisify(statfs);
    const root = getMediaRoot();
    const info = await statfsPromise(root);
    const total = Number(info.blocks) * Number(info.bsize);
    const free = Number(info.bfree) * Number(info.bsize);
    const usedPercent = total ? Math.round(((total - free) / total) * 1000) / 10 : 0;
    return {
      totalGb: Math.round((total / 1024 / 1024 / 1024) * 10) / 10,
      freeGb: Math.round((free / 1024 / 1024 / 1024) * 10) / 10,
      usedPercent,
    };
  } catch {
    return null;
  }
}

async function checkSupabaseAuth(): Promise<{ status: HealthStatus; detail?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { status: "degraded", detail: "Supabase env vars not configured" };
  }

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { status: "degraded", detail: `auth health HTTP ${res.status}` };
    }
    return { status: "healthy" };
  } catch (e) {
    return {
      status: "unhealthy",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function runHealthChecks(): Promise<HealthCheckResult> {
  const details: Record<string, string | number | boolean> = {};
  let database: HealthStatus = "healthy";
  let storage: HealthStatus = "healthy";
  let queue: HealthStatus = "healthy";
  let analytics: HealthStatus = "healthy";
  let graph: HealthStatus = "healthy";
  let redis: HealthStatus = isRedisConfigured() ? "healthy" : "degraded";
  let worker: HealthStatus = "healthy";

  const dbLatency = await measureDatabaseLatency();
  details.databaseLatencyMs = dbLatency.latencyMs ?? -1;
  if (dbLatency.status === "unhealthy") {
    database = "unhealthy";
    details.databaseError = dbLatency.error ?? "unknown";
  } else if (dbLatency.status === "degraded") {
    database = "degraded";
  }

  const { measureRedisLatency } = await import("@/lib/redis");
  const redisLatency = await measureRedisLatency();
  details.redisConfigured = isRedisConfigured();
  if (isRedisConfigured()) {
    details.redisLatencyMs = redisLatency.latencyMs ?? -1;
    if (!redisLatency.ok) {
      redis = "unhealthy";
      details.redisError = redisLatency.error ?? "unknown";
    } else if ((redisLatency.latencyMs ?? 0) > 100) {
      redis = "degraded";
    }
  } else {
    details.redisNote = "REDIS_URL not set — in-process fallbacks active";
  }

  try {
    const provider = getStorageProvider();
    details.mediaProvider = provider.name;
    if (provider.name === "local") {
      const { access } = await import("fs/promises");
      const { constants } = await import("fs");
      await access(getMediaRoot(), constants.R_OK | constants.W_OK);
      details.storageReachable = true;
      const disk = await measureDiskUsage();
      if (disk) {
        details.diskTotalGb = disk.totalGb;
        details.diskFreeGb = disk.freeGb;
        details.diskUsedPercent = disk.usedPercent;
        if (disk.usedPercent > 90) storage = "degraded";
      }
    } else {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.storage.from(STORAGE_BUCKET).list("", { limit: 1 });
      if (error) {
        storage = "degraded";
        details.storageError = error.message;
      } else {
        details.storageReachable = true;
      }
    }
  } catch (e) {
    storage = "unhealthy";
    details.storageError = e instanceof Error ? e.message : String(e);
  }

  try {
    const [pending, processing, dead] = await Promise.all([
      prisma.backgroundJob.count({ where: { status: "pending" } }),
      prisma.backgroundJob.count({ where: { status: "processing" } }),
      prisma.backgroundJob.count({ where: { status: "dead" } }),
    ]);
    details.queuePending = pending;
    details.queueProcessing = processing;
    details.queueDead = dead;
    details.queueSize = pending + processing;
    setGauge("queue_length", pending + processing);
    if (dead > 10 || pending > 500 || processing > 50) queue = "degraded";
  } catch (e) {
    queue = "unhealthy";
    details.queueError = e instanceof Error ? e.message : String(e);
  }

  try {
    const recent = await prisma.analyticsEvent.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    details.analyticsEvents24h = recent;
  } catch (e) {
    analytics = "unhealthy";
    details.analyticsError = e instanceof Error ? e.message : String(e);
  }

  try {
    const materialized = await isUserConnectionsMaterialized();
    const connectionCount = await prisma.userConnection.count();
    details.graphMaterialized = materialized;
    details.connectionCount = connectionCount;
    if (!materialized && connectionCount === 0) graph = "degraded";
  } catch (e) {
    graph = "unhealthy";
    details.graphError = e instanceof Error ? e.message : String(e);
  }

  try {
    const workerStatus = await getWorkerStatus();
    details.workerMediaPending = workerStatus.media.pending;
    details.workerMediaFailed = workerStatus.media.failed;
    details.workerLastSeen = workerStatus.lastHeartbeat ?? "unknown";
    if (workerStatus.media.failed > 20) worker = "degraded";
    if (!workerStatus.healthy) worker = "degraded";
  } catch (e) {
    worker = "degraded";
    details.workerError = e instanceof Error ? e.message : String(e);
  }

  const statuses = [database, storage, queue, analytics, graph, redis, worker];
  const status: HealthStatus = statuses.includes("unhealthy")
    ? "unhealthy"
    : statuses.includes("degraded")
      ? "degraded"
      : "healthy";

  return {
    status,
    database,
    storage,
    queue,
    analytics,
    graph,
    redis,
    worker,
    details,
    checkedAt: new Date().toISOString(),
  };
}

/** Production probe shape for load balancers and uptime monitors. */
export async function getProductionHealthSummary(options?: {
  verbose?: boolean;
  requestId?: string;
}): Promise<ProductionHealthSummary> {
  const [checks, supabaseAuth] = await Promise.all([runHealthChecks(), checkSupabaseAuth()]);
  const mem = process.memoryUsage();

  const supabase: HealthStatus =
    supabaseAuth.status === "unhealthy" || checks.storage === "unhealthy"
      ? "unhealthy"
      : supabaseAuth.status === "degraded" || checks.storage === "degraded"
        ? "degraded"
        : "healthy";

  const statuses = [checks.database, supabase, checks.redis, checks.worker];
  const status: HealthStatus = statuses.includes("unhealthy")
    ? "unhealthy"
    : statuses.includes("degraded")
      ? "degraded"
      : checks.status;

  const { readDeploymentBuildInfo } = await import("@/lib/server/deployment-info");
  const buildInfo = readDeploymentBuildInfo();
  const disk =
    typeof checks.details.diskTotalGb === "number"
      ? {
          totalGb: Number(checks.details.diskTotalGb),
          freeGb: Number(checks.details.diskFreeGb),
          usedPercent: Number(checks.details.diskUsedPercent),
        }
      : undefined;

  let activeUsers24h: number | undefined;
  try {
    activeUsers24h = await prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        userId: { not: null },
      },
    }).then((rows) => rows.length);
  } catch {
    /* optional */
  }

  return {
    status,
    database: checks.database,
    supabase,
    redis: checks.redis,
    storage: checks.storage,
    queue: checks.queue,
    worker: checks.worker,
    memory: {
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      externalMb: Math.round((mem.external / 1024 / 1024) * 10) / 10,
    },
    disk,
    uptime: Math.round(process.uptime()),
    nodeVersion: process.version,
    buildVersion: buildInfo?.version,
    gitCommit: buildInfo?.gitCommit,
    activeUsers24h,
    websocketConnections: 0,
    checkedAt: checks.checkedAt,
    requestId: options?.requestId,
    ...(buildInfo
      ? {
          deployment: {
            version: buildInfo.version,
            gitCommit: buildInfo.gitCommit,
            gitBranch: buildInfo.gitBranch,
            deploymentId: buildInfo.deploymentId,
            buildDate: buildInfo.buildDate,
          },
        }
      : {}),
    ...(options?.verbose
      ? {
          details: {
            ...checks.details,
            supabaseAuth: supabaseAuth.detail ?? "ok",
            prismaClient: checks.database === "healthy" ? "ok" : "error",
            versionEndpoint: buildInfo ? "ok" : "missing",
          },
        }
      : {}),
  };
}

export async function listJobs(args: { status?: string; cursor?: string; limit?: number }) {
  const limit = Math.min(args.limit ?? 20, 100);
  const rows = await prisma.backgroundJob.findMany({
    where: {
      ...(args.status ? { status: args.status as "pending" | "processing" | "completed" | "failed" | "dead" } : {}),
      ...(args.cursor ? { createdAt: { lt: new Date(args.cursor) } } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}

export async function jobQueueSummary() {
  const grouped = await prisma.backgroundJob.groupBy({ by: ["status"], _count: true });
  return Object.fromEntries(grouped.map((g) => [g.status, g._count]));
}
