import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { PushSubscribeSchema } from "@/lib/pwa/push-schemas";
import { pushSubscriptionService } from "@/services/notifications/push-subscription-service";
import { getVapidPublicKey } from "@/services/notifications/push-service";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { apiJson, withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async () => {
  const publicKey = getVapidPublicKey();
  let subscribed = false;

  try {
    const userAuth = await requireUserApi();
    if (!isApiAuthError(userAuth)) {
      subscribed = (await pushSubscriptionService.listForUser(userAuth.id)).length > 0;
    }
  } catch {
    /* unauthenticated or transient — return public key only */
  }

  return NextResponse.json({
    publicKey,
    subscribed,
    configured: Boolean(publicKey),
  });
});

export const POST = withApiHandler(async (request: Request) => {
  if (!getVapidPublicKey()) {
    return apiJson(503, {
      error: "Push notifications are not configured",
      code: "push_not_configured",
      reason: "VAPID keys are missing on the server.",
    });
  }

  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const user = userAuth;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiJson(422, { error: "Invalid JSON body", code: "invalid_json" });
  }

  const parsed = PushSubscribeSchema.safeParse(json);
  if (!parsed.success) {
    return apiJson(422, {
      error: "Invalid subscription payload",
      code: "validation_error",
    });
  }

  await pushSubscriptionService.save(user.id, parsed.data);
  void analyticsService.track({
    userId: user.id,
    eventType: ANALYTICS_EVENTS.PUSH_ENABLED,
  });
  return NextResponse.json({ ok: true });
});

export const DELETE = withApiHandler(async (request: Request) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const user = userAuth;
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) {
    return apiJson(400, { error: "endpoint required", code: "validation_error" });
  }
  await pushSubscriptionService.remove(user.id, endpoint);
  return NextResponse.json({ ok: true });
});
