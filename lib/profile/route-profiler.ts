import "server-only";

import {
  applyAuthProfileResponseHeaders,
  finishAuthRouteProfile,
  isAuthProfileEnabled,
  readAuthProfileMetrics,
} from "@/lib/auth-profile";
import {
  applyBenchmarkHeaders,
  buildBenchmarkMetrics,
  isProductionBenchmarkEnabled,
  sumPrismaQueries,
} from "@/lib/profile/production-benchmark";
import { getPhase2ProfileContext } from "@/lib/profile/phase2-profiler";
import { getPerfContext } from "@/lib/perf/context";

/** Temporary route profiler — enable with PROFILE_API=1 or PROFILE_PRODUCTION=1 */
export function isProfileEnabled(): boolean {
  return (
    process.env.PROFILE_API === "1" ||
    process.env.AUTH_PROFILE === "1" ||
    process.env.PROFILE_PRODUCTION === "1"
  );
}

export type ProfileSection = Record<string, number>;

export class RouteProfiler {
  private readonly route: string;
  private readonly t0: number;
  private sections: ProfileSection = {};
  private lastMark: number;

  constructor(route: string) {
    this.route = route;
    this.t0 = performance.now();
    this.lastMark = this.t0;
  }

  /** Record elapsed ms since previous mark (or start). */
  mark(label: string) {
    const now = performance.now();
    this.sections[label] = Math.round(now - this.lastMark);
    this.lastMark = now;
  }

  set(label: string, ms: number) {
    this.sections[label] = Math.round(ms);
    this.lastMark = performance.now();
  }

  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.sections[label] = Math.round(performance.now() - start);
      this.lastMark = performance.now();
    }
  }

  finish(extra?: ProfileSection) {
    const total = Math.round(performance.now() - this.t0);
    const merged = { ...this.sections, ...extra };
    if (isProfileEnabled() && process.env.PROFILE_API === "1") {
      const body = Object.entries(merged)
        .map(([k, v]) => `${k}=${v}ms`)
        .concat(`total=${total}ms`)
        .join("\n");
      console.log(`[PROFILE] ${this.route}\n${body}`);
    }
    if (isAuthProfileEnabled()) {
      // Auth summary + response headers are emitted from finishResponse() for API routes.
    }
  }

  finishResponse(response: Response): Response {
    const total = Math.round(performance.now() - this.t0);
    const serializeMs = this.sections.serialize ?? 0;
    const businessMs = Object.entries(this.sections)
      .filter(([k]) => !["auth", "serialize"].includes(k))
      .reduce((sum, [, v]) => sum + v, 0);

    const phase2Prisma = getPhase2ProfileContext()?.prismaQueries ?? [];
    const prismaMs =
      sumPrismaQueries(phase2Prisma) ||
      getPerfContext()?.prismaTotalMs ||
      readAuthProfileMetrics().prismaMs;

    const authMetrics = readAuthProfileMetrics();
    const externalMs = Math.max(
      0,
      total -
        authMetrics.middlewareMs -
        authMetrics.routeGetUserMs -
        prismaMs -
        serializeMs
    );

    if (isAuthProfileEnabled()) {
      finishAuthRouteProfile({
        route: this.route,
        serializeMs,
        otherMs: businessMs,
        totalMs: total,
      });
      applyAuthProfileResponseHeaders(response, {
        totalMs: total,
        serializeMs,
        otherMs: businessMs,
      });
    }

    if (isProductionBenchmarkEnabled()) {
      applyBenchmarkHeaders(
        response,
        buildBenchmarkMetrics({
          totalMs: total,
          routeAuthMs: authMetrics.routeGetUserMs,
          prismaMs,
          externalMs,
          serializeMs,
        })
      );
      if (authMetrics.requestId) {
        response.headers.set("x-bench-request-id", authMetrics.requestId);
      }
    }

    return response;
  }
}

export async function profileAuthBreakdown(): Promise<{
  supabaseAuth: number;
  dbUser: number;
  rbac: number;
  total: number;
}> {
  const { getAuthUser, getCurrentUser } = await import("@/lib/auth");

  const t0 = performance.now();
  const tSupabase0 = performance.now();
  const authUser = await getAuthUser();
  const supabaseAuth = Math.round(performance.now() - tSupabase0);

  if (!authUser) {
    return { supabaseAuth, dbUser: 0, rbac: 0, total: Math.round(performance.now() - t0) };
  }

  const tDb0 = performance.now();
  await getCurrentUser();
  const dbUser = Math.round(performance.now() - tDb0);

  return {
    supabaseAuth,
    dbUser: Math.max(0, dbUser - supabaseAuth),
    rbac: 0,
    total: Math.round(performance.now() - t0),
  };
}
