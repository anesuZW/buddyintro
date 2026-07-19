import "server-only";

type RedisClient = import("ioredis").default;

let redis: RedisClient | null = null;
let initialized = false;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

/** Lazy Redis client — never connect during module evaluation. */
export async function getRedis(): Promise<RedisClient | null> {
  if (initialized) return redis;
  initialized = true;

  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  try {
    const Redis = (await import("ioredis")).default;
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    await redis.connect();
    return redis;
  } catch {
    redis = null;
    return null;
  }
}

export function isRedisAvailable(): boolean {
  return redis !== null;
}

/** Measure Redis round-trip latency in milliseconds. */
export async function measureRedisLatency(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const client = await getRedis();
  if (!client) return { ok: false, error: "not configured" };
  try {
    const start = performance.now();
    await client.ping();
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
