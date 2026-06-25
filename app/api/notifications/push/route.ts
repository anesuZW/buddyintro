import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { notificationService } from "@/services/notifications/notification-service";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const body = SubscribeSchema.parse(await request.json());
  await notificationService.savePushSubscription(user.id, body);
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
  await notificationService.removePushSubscription(user.id, endpoint);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  });
}
