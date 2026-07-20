import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { PushSubscribeSchema } from "@/lib/pwa/push-schemas";
import { pushSubscriptionService } from "@/services/notifications/push-subscription-service";
import { getVapidPublicKey } from "@/services/notifications/push-service";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

/** Backward-compatible alias for /api/push/subscribe */
const SubscribeSchema = PushSubscribeSchema;

export async function POST(request: Request) {
  const user = await requireUser();
  const body = SubscribeSchema.parse(await request.json());
  await pushSubscriptionService.save(user.id, body);
  void analyticsService.track({
    userId: user.id,
    eventType: ANALYTICS_EVENTS.PUSH_ENABLED,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  await pushSubscriptionService.remove(user.id, endpoint);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    publicKey: getVapidPublicKey(),
  });
}
