import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { trackSecurityEvent, SECURITY_EVENT_TYPES } from "@/services/security-events";

export async function enforceRateLimit(userId: string, action: Parameters<typeof checkRateLimit>[1]) {
  const result = await checkRateLimit(userId, action);
  if (!result.ok) {
    void trackSecurityEvent({
      userId,
      eventType: SECURITY_EVENT_TYPES.RATE_LIMIT_HIT,
      severity: "low",
      metadata: { action, retryAfterSec: result.retryAfterSec },
    }).catch(() => {});
    return NextResponse.json(rateLimitResponse(result), {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    });
  }
  return null;
}
