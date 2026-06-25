import type { AuthSession, RequestSample, RouteDef } from "@/lib/load-test/types";

const BENCH = {
  authMs: "x-bench-auth-ms",
  prismaMs: "x-bench-prisma-ms",
  totalMs: "x-bench-total-ms",
  requestId: "x-bench-request-id",
} as const;

function numHeader(res: Response, name: string): number {
  const n = Number(res.headers.get(name));
  return Number.isFinite(n) ? n : 0;
}

export function resolveRoutes(fallbackMessagePath: string | null): RouteDef[] {
  return [
    { label: "/home", path: "/home", kind: "page" },
    { label: "/discoveries", path: "/discoveries", kind: "page" },
    { label: "/profile", path: "/profile", kind: "page" },
    { label: "/api/discoveries", path: "/api/discoveries", kind: "api" },
    { label: "/api/introductions", path: "/api/introductions?group=recent", kind: "api" },
    {
      label: "/api/messages/[userId]/context",
      path: fallbackMessagePath ?? "/api/messages/00000000-0000-0000-0000-000000000001/context",
      kind: "api",
    },
    { label: "/api/profile/insights", path: "/api/profile/insights", kind: "api" },
  ];
}

export async function fetchSample(
  base: string,
  route: RouteDef,
  session: AuthSession
): Promise<RequestSample> {
  const path =
    route.label === "/api/messages/[userId]/context" && session.messageContextPath
      ? session.messageContextPath
      : route.path;

  const url = `${base.replace(/\/$/, "")}${path}`;
  const start = performance.now();

  try {
    const res = await fetch(url, {
      headers: { Cookie: session.cookie },
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
    });
    const ttfbMs = Math.round(performance.now() - start);
    await res.arrayBuffer();
    const totalMs = Math.round(performance.now() - start);

    let authMs = numHeader(res, BENCH.authMs);
    let prismaMs = numHeader(res, BENCH.prismaMs);
    let serverTotalMs = numHeader(res, BENCH.totalMs);

    if (authMs === 0) {
      authMs =
        numHeader(res, "x-auth-profile-middleware-ms") +
        numHeader(res, "x-auth-profile-route-getuser-ms");
      prismaMs = prismaMs || numHeader(res, "x-auth-profile-prisma-ms");
      serverTotalMs = serverTotalMs || numHeader(res, "x-auth-profile-total-ms");
    }

    const ok = res.status >= 200 && res.status < 400;

    return {
      route: route.label,
      status: res.status,
      ttfbMs,
      totalMs,
      authMs,
      prismaMs,
      serverTotalMs: serverTotalMs || totalMs,
      error: !ok,
      ts: Date.now(),
    };
  } catch {
    const totalMs = Math.round(performance.now() - start);
    return {
      route: route.label,
      status: 0,
      ttfbMs: totalMs,
      totalMs,
      authMs: 0,
      prismaMs: 0,
      serverTotalMs: totalMs,
      error: true,
      ts: Date.now(),
    };
  }
}

export function pickSession(pool: AuthSession[], workerIndex: number): AuthSession {
  return pool[workerIndex % pool.length];
}

export function pickRoute(routes: RouteDef[]): RouteDef {
  return routes[Math.floor(Math.random() * routes.length)];
}

export function journeyRoutes(session: AuthSession): RouteDef[] {
  const ctx = session.messageContextPath
    ? [{ label: "/api/messages/[userId]/context", path: session.messageContextPath, kind: "api" as const }]
    : [];
  return [
    { label: "/home", path: "/home", kind: "page" },
    { label: "/discoveries", path: "/discoveries", kind: "page" },
    { label: "/profile", path: "/profile", kind: "page" },
    ...ctx,
    { label: "/introductions", path: "/introductions", kind: "page" },
  ];
}

export function randomPauseMs(min = 800, max = 2500): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
