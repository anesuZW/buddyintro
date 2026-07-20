import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { PushSubscribeSchema } from "@/lib/pwa/push-schemas";
import { pushSubscriptionService } from "@/services/notifications/push-subscription-service";
import { getVapidPublicKey } from "@/services/notifications/push-service";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

export async function GET() {
  const publicKey = getVapidPublicKey();
  let subscribed = false;

  try {
    const user = await requireUser();
    subscribed = (await pushSubscriptionService.listForUser(user.id)).length > 0;
  } catch {
    /* unauthenticated — return public key only */
  }

  return NextResponse.json({ publicKey, subscribed });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = PushSubscribeSchema.parse(await request.json());
  await pushSubscriptionService.save(user.id, body);
  void analyticsService.track({ userId: user.id, eventType: ANALYTICS_EVENTS.PUSH_ENABLED });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  await pushSubscriptionService.remove(user.id, endpoint);
  return NextResponse.json({ ok: true });
}
