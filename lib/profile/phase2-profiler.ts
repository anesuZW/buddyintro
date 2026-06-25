import "server-only";

import { AsyncLocalStorage } from "async_hooks";
import { readMiddlewareAuthMs, readAuthProfileMetrics } from "@/lib/auth-profile";
import {
  applyBenchmarkHeaders,
  buildBenchmarkMetrics,
  isProductionBenchmarkEnabled,
} from "@/lib/profile/production-benchmark";

/** Enable with PROFILE_API=1, PROFILE_PHASE2=1, or PROFILE_PRODUCTION=1 */
export function isPhase2ProfileEnabled(): boolean {
  return (
    process.env.PROFILE_API === "1" ||
    process.env.PROFILE_PHASE2 === "1" ||
    process.env.PROFILE_PRODUCTION === "1"
  );
}

export type Phase2PrismaQuery = {
  key: string;
  durationMs: number;
  count: number;
};

export type Phase2ProfileContext = {
  route: string;
  prismaQueries: Phase2PrismaQuery[];
};

const phase2Storage = new AsyncLocalStorage<Phase2ProfileContext>();
const profilerStorage = new AsyncLocalStorage<Phase2Profiler>();

export function runWithPhase2Profile<T>(route: string, fn: () => Promise<T>): Promise<T> {
  if (!isPhase2ProfileEnabled()) return fn();
  const profiler = new Phase2Profiler(route);
  const ctx: Phase2ProfileContext = { route, prismaQueries: [] };
  return profilerStorage.run(profiler, () =>
    phase2Storage.run(ctx, fn)
  );
}

export function getActivePhase2Profiler(): Phase2Profiler | undefined {
  return profilerStorage.getStore();
}

export function getPhase2ProfileContext(): Phase2ProfileContext | undefined {
  return phase2Storage.getStore();
}

/** Called from Prisma extension when phase2 profiling is active. */
export function recordPhase2PrismaQuery(
  model: string,
  operation: string,
  durationMs: number
): void {
  const ctx = phase2Storage.getStore();
  const profiler = profilerStorage.getStore();
  if (!ctx && !profiler) return;

  const key = `${model}.${operation}`;
  const bucket = ctx?.prismaQueries ?? profiler!.getPrismaQueries();
  const existing = bucket.find((q) => q.key === key);
  if (existing) {
    existing.durationMs += durationMs;
    existing.count += 1;
  } else {
    bucket.push({ key, durationMs, count: 1 });
  }
}

export type Phase2Issue = {
  kind:
    | "repeated-query"
    | "unnecessary-upsert-on-get"
    | "n-plus-one"
    | "sequential-await"
    | "repeated-auth"
    | "repeated-user-lookup"
    | "expensive-include";
  detail: string;
};

export function detectPhase2Issues(
  prismaQueries: Phase2PrismaQuery[],
  sections: Record<string, number>
): Phase2Issue[] {
  const issues: Phase2Issue[] = [];

  for (const q of prismaQueries) {
    if (q.count > 1) {
      issues.push({
        kind: "repeated-query",
        detail: `${q.key} executed ${q.count} times (${q.durationMs}ms total)`,
      });
    }
  }

  const upsert = prismaQueries.find((q) => q.key.endsWith(".upsert"));
  if (upsert && sections.readPath !== undefined) {
    issues.push({
      kind: "unnecessary-upsert-on-get",
      detail: `${upsert.key} on GET handler (${upsert.durationMs}ms)`,
    });
  }

  const userLookups = prismaQueries.filter((q) => q.key === "User.findUnique");
  if (userLookups.reduce((s, q) => s + q.count, 0) >= 3) {
    issues.push({
      kind: "repeated-user-lookup",
      detail: `User.findUnique called ${userLookups.reduce((s, q) => s + q.count, 0)} times`,
    });
  }

  const findMany = prismaQueries.filter(
    (q) => q.key.endsWith(".findMany") && q.count >= 3
  );
  for (const q of findMany) {
    issues.push({
      kind: "n-plus-one",
      detail: `Possible N+1: ${q.key} x${q.count} (${q.durationMs}ms)`,
    });
  }

  if ((sections.routeAuth ?? 0) > 100 && (sections.middlewareAuth ?? 0) > 0) {
    issues.push({
      kind: "repeated-auth",
      detail: `Handler auth segment ${sections.routeAuth}ms — may include Prisma user load, not a second Supabase getUser() under Phase 1`,
    });
  }

  const includes = prismaQueries.filter(
    (q) =>
      q.key.includes("ConversationContext") ||
      q.key.includes("Message.findFirst") ||
      q.key.includes("Story.findFirst")
  );
  for (const q of includes) {
    if (q.durationMs > 80) {
      issues.push({
        kind: "expensive-include",
        detail: `${q.key} ${q.durationMs}ms (includes/joins may be heavy)`,
      });
    }
  }

  if ((sections.accessControl ?? 0) > 50 && (sections.chatContext ?? 0) > 100) {
    if (
      (sections.accessControl ?? 0) + (sections.chatContext ?? 0) >
      (sections.parallelizable ?? 0)
    ) {
      // heuristic only when sequential segments logged
    }
  }

  return issues;
}

export class Phase2Profiler {
  private readonly route: string;
  private readonly t0: number;
  private readonly sections: Record<string, number> = {};
  private readonly prismaQueries: Phase2PrismaQuery[] = [];
  private middlewareAuth = 0;

  constructor(route: string) {
    this.route = route;
    this.t0 = performance.now();
    if (isPhase2ProfileEnabled()) {
      this.middlewareAuth = readMiddlewareAuthMs();
      this.sections.middlewareAuth = this.middlewareAuth;
    }
  }

  getPrismaQueries(): Phase2PrismaQuery[] {
    return this.prismaQueries;
  }

  set(label: string, ms: number): void {
    this.sections[label] = Math.round(ms);
  }

  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.sections[label] = Math.round(performance.now() - start);
    }
  }

  /** Times route-level auth (getCurrentUser / requireUser wrapper). */
  async timeRouteAuth<T>(fn: () => Promise<T>): Promise<T> {
    return this.time("routeAuth", fn);
  }

  log(extra?: Record<string, number>): void {
    if (!isPhase2ProfileEnabled()) return;

    const total = Math.round(performance.now() - this.t0);
    const merged = { ...this.sections, ...extra };
    const ctx = getPhase2ProfileContext();
    const profiler = getActivePhase2Profiler();
    let prismaQueries = ctx?.prismaQueries ?? profiler?.getPrismaQueries() ?? [];
    if (!prismaQueries.length && profiler) {
      prismaQueries = profiler.getPrismaQueries();
    }

    const routeAuth = merged.routeAuth ?? 0;
    const middlewareAuth = merged.middlewareAuth ?? this.middlewareAuth;
    const auth = middlewareAuth + routeAuth;
    const prismaTotal =
      prismaQueries.reduce((sum, q) => sum + q.durationMs, 0) ||
      merged.queryPreferences ||
      merged.listCategories ||
      merged.prisma ||
      0;
    const external = merged.external ?? 0;
    const storage = merged.storage ?? 0;
    const serialize = merged.serialize ?? 0;
    const response = merged.response ?? 0;

    const lines: string[] = [
      "[PROFILE]",
      `route=${this.route}`,
      `middlewareAuth=${middlewareAuth} ms`,
      `routeAuth=${routeAuth} ms`,
      `auth=${auth} ms`,
      `prisma=${prismaTotal} ms`,
    ];

    for (const q of [...prismaQueries].sort((a, b) => b.durationMs - a.durationMs)) {
      const suffix = q.count > 1 ? ` x${q.count}` : "";
      lines.push(`prisma[${q.key}]${suffix}=${q.durationMs} ms`);
    }

    lines.push(
      `external=${external} ms`,
      `storage=${storage} ms`,
      `serialize=${serialize} ms`,
      `response=${response} ms`,
      `total=${total} ms`
    );

    for (const [key, ms] of Object.entries(merged)) {
      if (
        [
          "middlewareAuth",
          "routeAuth",
          "prisma",
          "external",
          "storage",
          "serialize",
          "response",
        ].includes(key)
      ) {
        continue;
      }
      lines.push(`${key}=${ms} ms`);
    }

    const issues = detectPhase2Issues(prismaQueries, merged);
    for (const issue of issues) {
      lines.push(`[PROFILE-ISSUE] ${issue.kind}: ${issue.detail}`);
    }

    console.log(lines.join("\n"));
  }

  finishResponse(response: Response, extra?: Record<string, number>): Response {
    if (!isProductionBenchmarkEnabled()) return response;

    const total = Math.round(performance.now() - this.t0);
    const merged = { ...this.sections, ...extra };
    const ctx = getPhase2ProfileContext();
    const prismaQueries = ctx?.prismaQueries ?? this.prismaQueries;
    const routeAuth = merged.routeAuth ?? 0;
    const prismaTotal = prismaQueries.reduce((sum, q) => sum + q.durationMs, 0);
    const external = merged.external ?? 0;
    const storage = merged.storage ?? 0;
    const serialize = merged.serialize ?? 0;
    const externalMs = external + storage;

    return applyBenchmarkHeaders(
      response,
      {
        ...buildBenchmarkMetrics({
          totalMs: total,
          routeAuthMs: routeAuth,
          prismaMs: prismaTotal,
          externalMs,
          serializeMs: serialize,
        }),
        requestId: readAuthProfileMetrics().requestId,
      }
    );
  }
}
