import { PrismaClient } from "@prisma/client";
import { validateEnvironment } from "@/lib/diagnostics/env-validation";
import { readDeploymentBuildInfo } from "@/lib/diagnostics/deployment-info";
import { ensureLocalStorageReady } from "@/lib/diagnostics/storage-check";
import { getMediaProviderName } from "@/lib/storage/config";

export type StartupDiagnostic = {
  name: string;
  status: "ok" | "warn" | "error";
  detail?: string;
  messages?: string[];
};

async function measureRedisLatency(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return { ok: false, error: "not configured" };

  try {
    const Redis = (await import("ioredis")).default;
    const client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    await client.connect();
    const start = performance.now();
    await client.ping();
    const latencyMs = Math.round(performance.now() - start);
    await client.quit();
    return { ok: true, latencyMs };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Pure Node startup diagnostics — safe to run via tsx outside Next.js. */
export async function runStartupDiagnostics(): Promise<StartupDiagnostic[]> {
  const results: StartupDiagnostic[] = [];

  try {
    validateEnvironment({ strict: process.env.NODE_ENV === "production" });
    results.push({ name: "environment", status: "ok" });
  } catch (err) {
    results.push({
      name: "environment",
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const prisma = new PrismaClient();
  try {
    const start = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    results.push({
      name: "database",
      status: "ok",
      detail: `${Math.round(performance.now() - start)}ms`,
    });
  } catch (err) {
    results.push({
      name: "database",
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await prisma.$disconnect();
  }

  const provider = getMediaProviderName();
  if (provider === "local") {
    const storage = await ensureLocalStorageReady();
    results.push({
      name: "storage",
      status: storage.ok ? "ok" : "error",
      detail: storage.path,
      messages: storage.messages,
    });
  } else {
    results.push({ name: "storage", status: "ok", detail: provider });
  }

  const redis = await measureRedisLatency();
  results.push({
    name: "redis",
    status: redis.ok ? "ok" : redis.error === "not configured" ? "warn" : "error",
    detail: redis.ok ? `${redis.latencyMs}ms` : redis.error,
  });

  const build = readDeploymentBuildInfo();
  results.push({
    name: "build",
    status: build ? "ok" : "warn",
    detail: build ? `${build.version}@${build.gitCommit.slice(0, 7)}` : "missing build manifest",
  });

  return results;
}
