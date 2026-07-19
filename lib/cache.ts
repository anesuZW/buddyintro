import "server-only";

const memory = new Map<string, { value: string; expiresAt: number }>();

export type CacheOptions = {
  ttlSeconds?: number;
  tags?: string[];
};

const DEFAULT_TTL = 60;

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number) {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (memory.size > 5000) {
    const now = Date.now();
    for (const [k, v] of memory) {
      if (v.expiresAt <= now) memory.delete(k);
    }
  }
}

/** Read-through cache with Redis fallback to in-process memory. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const { getRedis } = await import("@/lib/redis");
  const redis = await getRedis();
  if (redis) {
    const raw = await redis.get(`cache:${key}`);
    if (raw) return JSON.parse(raw) as T;
  }
  const mem = memoryGet(key);
  return mem ? (JSON.parse(mem) as T) : null;
}

export async function cacheSet<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
  const ttl = options.ttlSeconds ?? DEFAULT_TTL;
  const serialized = JSON.stringify(value);
  const { getRedis } = await import("@/lib/redis");
  const redis = await getRedis();
  if (redis) {
    await redis.setex(`cache:${key}`, ttl, serialized);
    if (options.tags?.length) {
      for (const tag of options.tags) {
        await redis.sadd(`cache-tag:${tag}`, key);
        await redis.expire(`cache-tag:${tag}`, ttl * 2);
      }
    }
    return;
  }
  memorySet(key, serialized, ttl);
}

export async function cacheInvalidateTag(tag: string): Promise<void> {
  const { getRedis } = await import("@/lib/redis");
  const redis = await getRedis();
  if (redis) {
    const keys = await redis.smembers(`cache-tag:${tag}`);
    if (keys.length) {
      await redis.del(...keys.map((k) => `cache:${k}`));
    }
    await redis.del(`cache-tag:${tag}`);
    return;
  }
  for (const key of [...memory.keys()]) {
    if (key.includes(tag)) memory.delete(key);
  }
}

export async function cacheGetOrSet<T>(
  key: string,
  loader: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const value = await loader();
  await cacheSet(key, value, options);
  return value;
}

/** Standard cache key builders — invalidate by tag from write paths. */
export const CacheKeys = {
  userProfile: (userId: string) => `user:profile:${userId}`,
  feed: (userId: string, cursor?: string) => `feed:${userId}:${cursor ?? "0"}`,
  stories: (userId: string) => `stories:${userId}`,
  discoveries: (userId: string, cursor?: string) => `discoveries:${userId}:${cursor ?? "0"}`,
  networkGraph: (userId: string) => `graph:${userId}`,
  notificationCount: (userId: string) => `notifications:count:${userId}`,
};

export const CacheTags = {
  user: (userId: string) => `user:${userId}`,
  feed: (userId: string) => `feed:${userId}`,
  stories: (userId: string) => `stories:${userId}`,
  discoveries: (userId: string) => `discoveries:${userId}`,
  notifications: (userId: string) => `notifications:${userId}`,
};
