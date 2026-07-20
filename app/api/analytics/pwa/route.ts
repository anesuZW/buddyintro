import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { PWA_ANALYTICS } from "@/lib/pwa/analytics";

const Schema = z.object({
  event: z.enum([
    "app_installed",
    PWA_ANALYTICS.INSTALL,
    PWA_ANALYTICS.INSTALL_DISMISSED,
    PWA_ANALYTICS.NOTIFICATION_ENABLED,
    PWA_ANALYTICS.NOTIFICATION_DENIED,
    PWA_ANALYTICS.NOTIFICATION_CLICKED,
    PWA_ANALYTICS.OFFLINE,
    PWA_ANALYTICS.ONLINE,
    PWA_ANALYTICS.BACKGROUND_SYNC,
    PWA_ANALYTICS.UPDATE_INSTALLED,
    PWA_ANALYTICS.UPDATE_DISMISSED,
  ] as [string, ...string[]]),
  metadata: z.record(z.unknown()).optional(),
});

const EVENT_MAP: Record<string, string> = {
  app_installed: ANALYTICS_EVENTS.APP_INSTALLED,
  [PWA_ANALYTICS.INSTALL]: ANALYTICS_EVENTS.APP_INSTALLED,
  [PWA_ANALYTICS.NOTIFICATION_ENABLED]: ANALYTICS_EVENTS.PUSH_ENABLED,
};

export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  const body = Schema.parse(await request.json());
  const eventType = EVENT_MAP[body.event] ?? body.event;

  void analyticsService.track({
    userId: user?.id,
    eventType,
    metadata: body.metadata,
  });

  return NextResponse.json({ ok: true });
}
