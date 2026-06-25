/** Lightweight counters safe for Edge middleware and Node server routes. */

type QueryBucket = { count: number; totalMs: number };

let activeRequests = 0;
let totalPrismaQueries = 0;
let totalPrismaMs = 0;
const prismaHistogram = new Map<string, QueryBucket>();
let authMiddlewareTotalMs = 0;
let authMiddlewareSamples = 0;

export function incrementActiveRequests(): void {
  activeRequests += 1;
}

export function decrementActiveRequests(): void {
  activeRequests = Math.max(0, activeRequests - 1);
}

export function getActiveRequestCount(): number {
  return activeRequests;
}

export function recordRuntimePrismaQuery(
  model: string,
  operation: string,
  durationMs: number
): void {
  totalPrismaQueries += 1;
  totalPrismaMs += durationMs;
  const key = `${model}.${operation}`;
  const bucket = prismaHistogram.get(key) ?? { count: 0, totalMs: 0 };
  bucket.count += 1;
  bucket.totalMs += durationMs;
  prismaHistogram.set(key, bucket);
}

export function recordRuntimeAuthMiddleware(ms: number): void {
  if (ms <= 0) return;
  authMiddlewareTotalMs += ms;
  authMiddlewareSamples += 1;
}

export function resetRuntimePrismaStats(): void {
  totalPrismaQueries = 0;
  totalPrismaMs = 0;
  prismaHistogram.clear();
}

export function readRuntimeCounters() {
  const topQueries = [...prismaHistogram.entries()]
    .map(([key, v]) => ({
      key,
      count: v.count,
      totalMs: v.totalMs,
      avgMs: v.count ? Math.round(v.totalMs / v.count) : 0,
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 25);

  return {
    activeRequests,
    totalPrismaQueries,
    totalPrismaMs,
    avgQueryMs: totalPrismaQueries
      ? Math.round(totalPrismaMs / totalPrismaQueries)
      : 0,
    topQueries,
    authMiddlewareTotalMs,
    authMiddlewareSamples,
    avgAuthMiddlewareMs: authMiddlewareSamples
      ? Math.round(authMiddlewareTotalMs / authMiddlewareSamples)
      : 0,
  };
}
