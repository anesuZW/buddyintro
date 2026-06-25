import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

const CLIENT_EVENTS = new Set<string>([
  ANALYTICS_EVENTS.INTRODUCTION_VIEWED,
  ANALYTICS_EVENTS.DISCOVERY_VIEWED,
  ANALYTICS_EVENTS.DISCOVERY_OPENED,
  ANALYTICS_EVENTS.DISCOVERY_BANNER_VIEWED,
  ANALYTICS_EVENTS.TRUST_PROFILE_VIEWED,
  ANALYTICS_EVENTS.SHARED_INTRODUCERS_OPENED,
]);

const Schema = z.object({
  eventType: z.string(),
  entityType: z.string().nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
  metadata: z
    .record(z.unknown())
    .optional()
    .refine((value) => !value || JSON.stringify(value).length <= 2000, {
      message: "Metadata too large",
    }),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const body = Schema.parse(await request.json());

  if (!CLIENT_EVENTS.has(body.eventType)) {
    return NextResponse.json({ error: "Event type not allowed" }, { status: 400 });
  }

  void analyticsService.track({
    userId: user.id,
    eventType: body.eventType,
    entityType: body.entityType ?? null,
    entityId: body.entityId ?? null,
    metadata: body.metadata,
  });

  return NextResponse.json({ ok: true });
}
