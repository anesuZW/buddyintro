import "server-only";

import { readMiddlewareAuthMs, readAuthProfileMetrics } from "@/lib/auth-profile";
import type { Phase2PrismaQuery } from "@/lib/profile/phase2-profiler";

/** Enable production benchmark headers and logging. Does not change business logic. */
export function isProductionBenchmarkEnabled(): boolean {
  return process.env.PROFILE_PRODUCTION === "1";
}

/** Enable runtime metrics endpoint (/api/bench/runtime). */
export function isRuntimeMetricsEnabled(): boolean {
  return process.env.HEALTH_MONITORING === "1" || isProductionBenchmarkEnabled();
}

export const BENCH_HEADERS = {
  requestId: "x-bench-request-id",
  authMs: "x-bench-auth-ms",
  prismaMs: "x-bench-prisma-ms",
  externalMs: "x-bench-external-ms",
  serializeMs: "x-bench-serialize-ms",
  totalMs: "x-bench-total-ms",
  mode: "x-bench-mode",
} as const;

export type BenchmarkMetrics = {
  authMs: number;
  prismaMs: number;
  externalMs: number;
  serializeMs: number;
  totalMs: number;
};

const pageMetrics = new Map<
  string,
  BenchmarkMetrics & { route: string; queryCount: number; capturedAt: number }
>();

const PAGE_METRICS_TTL_MS = 60_000;

function prunePageMetrics(): void {
  const cutoff = Date.now() - PAGE_METRICS_TTL_MS;
  for (const [id, entry] of pageMetrics) {
    if (entry.capturedAt < cutoff) pageMetrics.delete(id);
  }
}

export function stashPageBenchmarkMetrics(input: {
  requestId: string;
  route: string;
  totalMs: number;
  prismaMs: number;
  queryCount: number;
  serializeMs?: number;
}): void {
  if (!isProductionBenchmarkEnabled()) return;
  prunePageMetrics();
  const auth = readAuthProfileMetrics();
  const authMs = auth.middlewareMs + auth.routeGetUserMs;
  const serializeMs = input.serializeMs ?? 0;
  pageMetrics.set(input.requestId, {
    route: input.route,
    authMs,
    prismaMs: input.prismaMs,
    externalMs: Math.max(0, input.totalMs - authMs - input.prismaMs - serializeMs),
    serializeMs,
    totalMs: input.totalMs,
    queryCount: input.queryCount,
    capturedAt: Date.now(),
  });
}

export function readPageBenchmarkMetrics(requestId: string) {
  return pageMetrics.get(requestId) ?? null;
}

export function sumPrismaQueries(queries: Phase2PrismaQuery[]): number {
  return queries.reduce((sum, q) => sum + q.durationMs, 0);
}

export function readBenchmarkRequestId(): string | null {
  if (!isProductionBenchmarkEnabled()) return null;
  return readAuthProfileMetrics().requestId;
}

export function applyBenchmarkHeaders(
  response: Response,
  input: BenchmarkMetrics & { requestId?: string | null }
): Response {
  if (!isProductionBenchmarkEnabled()) return response;

  const h = BENCH_HEADERS;
  if (input.requestId) response.headers.set(h.requestId, input.requestId);
  response.headers.set(h.authMs, String(input.authMs));
  response.headers.set(h.prismaMs, String(input.prismaMs));
  response.headers.set(h.externalMs, String(input.externalMs));
  response.headers.set(h.serializeMs, String(input.serializeMs));
  response.headers.set(h.totalMs, String(input.totalMs));
  response.headers.set(h.mode, "production");

  const serverTiming = [
    `auth;dur=${input.authMs}`,
    `prisma;dur=${input.prismaMs}`,
    `external;dur=${input.externalMs}`,
    `serialize;dur=${input.serializeMs}`,
    `total;dur=${input.totalMs}`,
  ].join(", ");
  response.headers.set("Server-Timing", serverTiming);

  return response;
}

export function buildBenchmarkMetrics(input: {
  totalMs: number;
  routeAuthMs?: number;
  prismaMs: number;
  externalMs?: number;
  serializeMs?: number;
}): BenchmarkMetrics {
  const middlewareAuth = readMiddlewareAuthMs();
  const routeAuth = input.routeAuthMs ?? 0;
  const authMs = middlewareAuth + routeAuth;
  const serializeMs = input.serializeMs ?? 0;
  const externalMs =
    input.externalMs ??
    Math.max(0, input.totalMs - authMs - input.prismaMs - serializeMs);

  return {
    authMs,
    prismaMs: input.prismaMs,
    externalMs,
    serializeMs,
    totalMs: input.totalMs,
  };
}
