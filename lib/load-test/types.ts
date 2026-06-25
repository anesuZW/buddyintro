export type RouteDef = {
  label: string;
  path: string;
  kind: "page" | "api";
};

export type RequestSample = {
  route: string;
  status: number;
  ttfbMs: number;
  totalMs: number;
  authMs: number;
  prismaMs: number;
  serverTotalMs: number;
  error: boolean;
  ts: number;
};

export type RouteStats = {
  route: string;
  count: number;
  errors: number;
  errorRate: number;
  rps: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  avgAuthMs: number;
  avgPrismaMs: number;
  avgServerMs: number;
};

export type ConcurrencyRun = {
  concurrency: number;
  durationSec: number;
  mode: "routes" | "journey";
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  rps: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  routes: RouteStats[];
  startedAt: string;
  endedAt: string;
};

export type ConcurrencyResults = {
  generatedAt: string;
  base: string;
  authPoolSize: number;
  routeRuns: ConcurrencyRun[];
  journeyRuns: ConcurrencyRun[];
};

export type AuthSession = {
  email: string;
  cookie: string;
  userId: string;
  messageContextPath: string | null;
};
