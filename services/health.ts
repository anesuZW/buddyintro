import "server-only";

import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/constants";
import { isUserConnectionsMaterialized } from "@/services/introduction-graph-builder";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type HealthCheckResult = {
  status: HealthStatus;
  database: HealthStatus;
  storage: HealthStatus;
  queue: HealthStatus;
  analytics: HealthStatus;
  graph: HealthStatus;
  details: Record<string, string | number | boolean>;
  checkedAt: string;
};

export type ProductionHealthSummary = {
  status: HealthStatus;
  database: HealthStatus;
  supabase: HealthStatus;
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
  };
  uptime: number;
  checkedAt: string;
  details?: Record<string, string | number | boolean>;
};

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

  try {
    await prisma.$queryRaw`SELECT 1`;
    details.databaseOk = true;
  } catch (e) {
    database = "unhealthy";
    details.databaseError = e instanceof Error ? e.message : String(e);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage.from(STORAGE_BUCKET).list("", { limit: 1 });
    if (error) {
      storage = "degraded";
      details.storageError = error.message;
    } else {
      details.storageReachable = true;
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

  const statuses = [database, storage, queue, analytics, graph];
  const status: HealthStatus = statuses.includes("unhealthy")
    ? "unhealthy"
    : statuses.includes("degraded")
      ? "degraded"
      : "healthy";

  return { status, database, storage, queue, analytics, graph, details, checkedAt: new Date().toISOString() };
}

/** Production probe shape for load balancers and uptime monitors. */
export async function getProductionHealthSummary(options?: {
  verbose?: boolean;
}): Promise<ProductionHealthSummary> {
  const [checks, supabaseAuth] = await Promise.all([runHealthChecks(), checkSupabaseAuth()]);
  const mem = process.memoryUsage();

  const supabase: HealthStatus =
    supabaseAuth.status === "unhealthy" || checks.storage === "unhealthy"
      ? "unhealthy"
      : supabaseAuth.status === "degraded" || checks.storage === "degraded"
        ? "degraded"
        : "healthy";

  const statuses = [checks.database, supabase];
  const status: HealthStatus = statuses.includes("unhealthy")
    ? "unhealthy"
    : statuses.includes("degraded")
      ? "degraded"
      : checks.status;

  return {
    status,
    database: checks.database,
    supabase,
    memory: {
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    },
    uptime: Math.round(process.uptime()),
    checkedAt: checks.checkedAt,
    ...(options?.verbose ? { details: { ...checks.details, supabaseAuth: supabaseAuth.detail ?? "ok" } } : {}),
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
