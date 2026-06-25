import "server-only";

import { headers } from "next/headers";

/** Enable with AUTH_PROFILE=1 or PROFILE_PRODUCTION=1 — logs duplicate auth evidence; does not change auth behavior. */
export function isAuthProfileEnabled(): boolean {
  return process.env.AUTH_PROFILE === "1" || process.env.PROFILE_PRODUCTION === "1";
}

export const AUTH_PROFILE_ID_HEADER = "x-auth-profile-id";
export const AUTH_PROFILE_MIDDLEWARE_MS_HEADER = "x-auth-profile-middleware-ms";

/** Response headers set on API routes for automated collection scripts. */
export const AUTH_PROFILE_RESPONSE_HEADERS = {
  id: "x-auth-profile-id",
  middlewareMs: "x-auth-profile-middleware-ms",
  routeGetUserMs: "x-auth-profile-route-getuser-ms",
  prismaMs: "x-auth-profile-prisma-ms",
  serializeMs: "x-auth-profile-serialize-ms",
  otherMs: "x-auth-profile-other-ms",
  totalMs: "x-auth-profile-total-ms",
  getUserCalls: "x-auth-profile-getuser-calls",
} as const;

type AuthProfileStore = {
  routeGetUserMs: number;
  prismaMs: number;
  getAuthUserCalls: number;
  getCurrentUserCalls: number;
};

const metricsByRequest = new Map<string, AuthProfileStore>();

function createStore(): AuthProfileStore {
  return {
    routeGetUserMs: 0,
    prismaMs: 0,
    getAuthUserCalls: 0,
    getCurrentUserCalls: 0,
  };
}

function getOrCreateStore(requestId: string): AuthProfileStore {
  let store = metricsByRequest.get(requestId);
  if (!store) {
    store = createStore();
    metricsByRequest.set(requestId, store);
  }
  return store;
}

function resolveRequestId(explicit?: string | null): string | null {
  if (explicit) return explicit;
  if (!isAuthProfileEnabled()) return null;
  try {
    return headers().get(AUTH_PROFILE_ID_HEADER);
  } catch {
    return null;
  }
}

export function runWithAuthProfile<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

export function readAuthProfileRequestId(): string | null {
  return resolveRequestId();
}

export function readMiddlewareAuthMs(): number {
  if (!isAuthProfileEnabled()) return 0;
  try {
    const raw = headers().get(AUTH_PROFILE_MIDDLEWARE_MS_HEADER);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function logAuthProfile(
  requestId: string | null,
  label: string,
  metrics: Record<string, number | string>
): void {
  if (!isAuthProfileEnabled()) return;
  const id = requestId ?? "unknown";
  const body = Object.entries(metrics)
    .map(([k, v]) => {
      if (typeof v === "string") return `${k}=${v}`;
      if (k === "getUserCalls" || k.endsWith("Calls")) return `${k}=${v}`;
      return `${k}=${v}ms`;
    })
    .join("\n");
  console.log(`[AUTH-PROFILE][${id}]\n${label}\n${body}`);
}

export function recordSupabaseGetUser(ms: number): void {
  if (!isAuthProfileEnabled()) return;
  const requestId = resolveRequestId();
  if (!requestId) return;
  const store = getOrCreateStore(requestId);
  store.getAuthUserCalls += 1;
  store.routeGetUserMs += ms;
}

export function recordPrismaUserLookup(ms: number): void {
  if (!isAuthProfileEnabled()) return;
  const requestId = resolveRequestId();
  if (!requestId) return;
  getOrCreateStore(requestId).prismaMs += ms;
}

export function recordGetCurrentUserCall(): void {
  if (!isAuthProfileEnabled()) return;
  const requestId = resolveRequestId();
  if (!requestId) return;
  getOrCreateStore(requestId).getCurrentUserCalls += 1;
}

function readStore(requestId: string | null): AuthProfileStore | undefined {
  if (!requestId) return undefined;
  return metricsByRequest.get(requestId);
}

export function readAuthProfileMetrics(): {
  requestId: string | null;
  middlewareMs: number;
  routeGetUserMs: number;
  prismaMs: number;
} {
  const requestId = readAuthProfileRequestId();
  const middlewareMs = readMiddlewareAuthMs();
  const store = readStore(requestId);
  return {
    requestId,
    middlewareMs,
    routeGetUserMs: store?.routeGetUserMs ?? 0,
    prismaMs: store?.prismaMs ?? 0,
  };
}

export function finishAuthRouteProfile(input: {
  route: string;
  serializeMs?: number;
  otherMs?: number;
  totalMs: number;
}): void {
  if (!isAuthProfileEnabled()) return;

  const requestId = readAuthProfileRequestId();
  const middlewareMs = readMiddlewareAuthMs();
  const store = readStore(requestId);
  const routeGetUserMs = store?.routeGetUserMs ?? 0;
  const prismaMs = store?.prismaMs ?? 0;
  const getAuthUserCalls = store?.getAuthUserCalls ?? 0;
  const serializeMs = input.serializeMs ?? 0;
  const otherMs = input.otherMs ?? Math.max(
    0,
    input.totalMs - middlewareMs - routeGetUserMs - prismaMs - serializeMs
  );

  const middlewareCalls = middlewareMs > 0 ? 1 : 0;
  const totalGetUserCalls = middlewareCalls + getAuthUserCalls;
  const duplicateAuth = totalGetUserCalls >= 2 ? "yes" : "no";

  logAuthProfile(requestId, `route-summary ${input.route}`, {
    middlewareGetUser: middlewareMs,
    routeGetUser: routeGetUserMs,
    prisma: prismaMs,
    serialize: serializeMs,
    other: otherMs,
    total: input.totalMs,
    getUserCalls: totalGetUserCalls,
    duplicateAuth,
  });
}

export function applyAuthProfileResponseHeaders(
  response: Response,
  input: {
    totalMs: number;
    serializeMs?: number;
    otherMs?: number;
  }
): Response {
  if (!isAuthProfileEnabled()) return response;

  const requestId = readAuthProfileRequestId();
  const middlewareMs = readMiddlewareAuthMs();
  const store = readStore(requestId);
  const routeGetUserMs = store?.routeGetUserMs ?? 0;
  const prismaMs = store?.prismaMs ?? 0;
  const getAuthUserCalls = store?.getAuthUserCalls ?? 0;
  const serializeMs = input.serializeMs ?? 0;
  const otherMs = input.otherMs ?? Math.max(
    0,
    input.totalMs - middlewareMs - routeGetUserMs - prismaMs - serializeMs
  );
  const middlewareCalls = middlewareMs > 0 ? 1 : 0;

  const h = AUTH_PROFILE_RESPONSE_HEADERS;
  if (requestId) response.headers.set(h.id, requestId);
  response.headers.set(h.middlewareMs, String(middlewareMs));
  response.headers.set(h.routeGetUserMs, String(routeGetUserMs));
  response.headers.set(h.prismaMs, String(prismaMs));
  response.headers.set(h.serializeMs, String(serializeMs));
  response.headers.set(h.otherMs, String(otherMs));
  response.headers.set(h.totalMs, String(input.totalMs));
  response.headers.set(h.getUserCalls, String(middlewareCalls + getAuthUserCalls));

  if (requestId) metricsByRequest.delete(requestId);

  return response;
}
