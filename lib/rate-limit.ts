/**
 * Rate limiting with Redis fallback to in-process sliding window.
 */
import "server-only";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  "messages:post": { max: 30, windowMs: 60_000 },
  "stories:post": { max: 10, windowMs: 60_000 },
  "discoveries:post": { max: 10, windowMs: 60_000 },
  "invites:post": { max: 20, windowMs: 60_000 },
  "auth:login": { max: 10, windowMs: 300_000 },
  "api:global": { max: 120, windowMs: 60_000 },
};

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSec: number };

async function redisRateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult | null> {
  const { getRedis } = await import("@/lib/redis");
  const redis = await getRedis();
  if (!redis) return null;
  const redisKey = `ratelimit:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) await redis.pexpire(redisKey, windowMs);
  const ttl = await redis.pttl(redisKey);
  const resetAt = Date.now() + Math.max(ttl, 0);
  if (count > max) {
    return { ok: false, remaining: 0, resetAt, retryAfterSec: Math.ceil(Math.max(ttl, 0) / 1000) };
  }
  return { ok: true, remaining: max - count, resetAt };
}

function memoryRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  if (bucket.count >= max) {
    return {
      ok: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  bucket.count += 1;
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }
  return { ok: true, remaining: max - bucket.count, resetAt: bucket.resetAt };
}

export async function checkRateLimit(userId: string, action: keyof typeof LIMITS): Promise<RateLimitResult> {
  const config = LIMITS[action];
  if (!config) return { ok: true, remaining: 999, resetAt: Date.now() + 60_000 };

  const key = `${action}:${userId}`;
  const redisResult = await redisRateLimit(key, config.max, config.windowMs);
  if (redisResult) return redisResult;
  return memoryRateLimit(key, config.max, config.windowMs);
}

/** Synchronous compatibility wrapper for existing call sites. */
export function checkRateLimitSync(userId: string, action: keyof typeof LIMITS): RateLimitResult {
  const config = LIMITS[action];
  if (!config) return { ok: true, remaining: 999, resetAt: Date.now() + 60_000 };
  return memoryRateLimit(`${action}:${userId}`, config.max, config.windowMs);
}

export function rateLimitResponse(result: Extract<RateLimitResult, { ok: false }>) {
  return {
    error: "Too many requests. Please slow down.",
    code: "rate_limit_exceeded",
    retryAfterSec: result.retryAfterSec,
  };
}
