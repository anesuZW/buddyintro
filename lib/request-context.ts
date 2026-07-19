import "server-only";

import { AsyncLocalStorage } from "async_hooks";

export type RequestContext = {
  requestId: string;
  userId?: string;
  route?: string;
  startedAt: number;
  durationMs?: number;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function setRequestContextUser(userId: string | undefined) {
  const ctx = storage.getStore();
  if (ctx) ctx.userId = userId;
}

export function setRequestContextRoute(route: string) {
  const ctx = storage.getStore();
  if (ctx) ctx.route = route;
}

export function finalizeRequestContextDuration() {
  const ctx = storage.getStore();
  if (ctx) ctx.durationMs = Math.round(performance.now() - ctx.startedAt);
}

export { REQUEST_ID_HEADER, generateRequestId } from "@/lib/request-id";
