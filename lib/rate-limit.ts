/**
 * In-process sliding-window rate limiter.
 * Swap for Redis/Upstash in production without changing call sites.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  "messages:post": { max: 30, windowMs: 60_000 },
  "stories:post": { max: 10, windowMs: 60_000 },
  "discoveries:post": { max: 10, windowMs: 60_000 },
  "invites:post": { max: 20, windowMs: 60_000 },
};

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSec: number };

export function checkRateLimit(userId: string, action: keyof typeof LIMITS): RateLimitResult {
  const config = LIMITS[action];
  if (!config) return { ok: true, remaining: 999, resetAt: Date.now() + 60_000 };

  const key = `${action}:${userId}`;
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + config.windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= config.max) {
    return {
      ok: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;

  // Prevent unbounded map growth
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }

  return {
    ok: true,
    remaining: config.max - bucket.count,
    resetAt: bucket.resetAt,
  };
}

export function rateLimitResponse(result: Extract<RateLimitResult, { ok: false }>) {
  return {
    error: "Too many requests. Please slow down.",
    code: "rate_limit_exceeded",
    retryAfterSec: result.retryAfterSec,
  };
}
