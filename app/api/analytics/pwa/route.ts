import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

const Schema = z.object({
  event: z.enum(["app_installed"]),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const body = Schema.parse(await request.json());
  if (body.event === "app_installed") {
    void analyticsService.track({
      userId: user.id,
      eventType: ANALYTICS_EVENTS.APP_INSTALLED,
    });
  }
  return NextResponse.json({ ok: true });
}
