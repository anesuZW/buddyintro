import type { RequestSample, RouteStats } from "@/lib/load-test/types";

const MAX_SAMPLES_PER_ROUTE = 3000;

export type RouteAccumulator = {
  route: string;
  count: number;
  errors: number;
  totalMs: number[];
  authMs: number[];
  prismaMs: number[];
  serverMs: number[];
};

export function newAccumulator(route: string): RouteAccumulator {
  return {
    route,
    count: 0,
    errors: 0,
    totalMs: [],
    authMs: [],
    prismaMs: [],
    serverMs: [],
  };
}

export function addSample(acc: RouteAccumulator, s: RequestSample) {
  acc.count += 1;
  if (s.error) acc.errors += 1;
  if (acc.totalMs.length < MAX_SAMPLES_PER_ROUTE) {
    acc.totalMs.push(s.totalMs);
    acc.authMs.push(s.authMs);
    acc.prismaMs.push(s.prismaMs);
    acc.serverMs.push(s.serverTotalMs);
  }
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function aggregateRouteStatsFromAccumulators(
  accumulators: Map<string, RouteAccumulator>,
  durationSec: number
): RouteStats[] {
  return [...accumulators.values()]
    .map((acc) => {
      const totals = [...acc.totalMs].sort((a, b) => a - b);
      return {
        route: acc.route,
        count: acc.count,
        errors: acc.errors,
        errorRate: acc.count ? acc.errors / acc.count : 0,
        rps: durationSec > 0 ? Math.round((acc.count / durationSec) * 100) / 100 : 0,
        avgMs: avg(totals),
        medianMs: median(totals),
        p95Ms: percentile(totals, 95),
        p99Ms: percentile(totals, 99),
        avgAuthMs: avg(acc.authMs),
        avgPrismaMs: avg(acc.prismaMs),
        avgServerMs: avg(acc.serverMs),
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

export function aggregateRunFromAccumulators(
  accumulators: Map<string, RouteAccumulator>,
  durationSec: number
) {
  const allTotals: number[] = [];
  let errors = 0;
  let count = 0;
  for (const acc of accumulators.values()) {
    count += acc.count;
    errors += acc.errors;
    allTotals.push(...acc.totalMs);
  }
  allTotals.sort((a, b) => a - b);
  return {
    totalRequests: count,
    totalErrors: errors,
    errorRate: count ? errors / count : 0,
    rps: durationSec > 0 ? Math.round((count / durationSec) * 100) / 100 : 0,
    avgMs: avg(allTotals),
    medianMs: median(allTotals),
    p95Ms: percentile(allTotals, 95),
    p99Ms: percentile(allTotals, 99),
  };
}

export function aggregateRouteStats(samples: RequestSample[], durationSec: number): RouteStats[] {
  const byRoute = new Map<string, RequestSample[]>();
  for (const s of samples) {
    const list = byRoute.get(s.route) ?? [];
    list.push(s);
    byRoute.set(s.route, list);
  }

  return [...byRoute.entries()]
    .map(([route, rows]) => {
      const totals = rows.map((r) => r.totalMs).sort((a, b) => a - b);
      const errors = rows.filter((r) => r.error).length;
      return {
        route,
        count: rows.length,
        errors,
        errorRate: rows.length ? errors / rows.length : 0,
        rps: durationSec > 0 ? Math.round((rows.length / durationSec) * 100) / 100 : 0,
        avgMs: avg(totals),
        medianMs: median(totals),
        p95Ms: percentile(totals, 95),
        p99Ms: percentile(totals, 99),
        avgAuthMs: avg(rows.map((r) => r.authMs)),
        avgPrismaMs: avg(rows.map((r) => r.prismaMs)),
        avgServerMs: avg(rows.map((r) => r.serverTotalMs)),
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

export function aggregateRun(samples: RequestSample[], durationSec: number) {
  const totals = samples.map((s) => s.totalMs).sort((a, b) => a - b);
  const errors = samples.filter((s) => s.error).length;
  return {
    totalRequests: samples.length,
    totalErrors: errors,
    errorRate: samples.length ? errors / samples.length : 0,
    rps: durationSec > 0 ? Math.round((samples.length / durationSec) * 100) / 100 : 0,
    avgMs: avg(totals),
    medianMs: median(totals),
    p95Ms: percentile(totals, 95),
    p99Ms: percentile(totals, 99),
  };
}
