import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { deleteStory, getStoryForViewer } from "@/services/stories";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { apiJson, withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async (
  _req: Request,
  { params }: { params: { id: string } }
) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;

  const story = await getStoryForViewer(params.id, userAuth.id);
  if (!story) {
    return apiJson(404, { error: "Not found", code: "not_found" });
  }

  void analyticsService.track({
    userId: userAuth.id,
    eventType: ANALYTICS_EVENTS.INTRODUCTION_VIEWED,
    entityType: "story",
    entityId: params.id,
  });

  return NextResponse.json({ story });
});

export const DELETE = withApiHandler(async (
  _req: Request,
  { params }: { params: { id: string } }
) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;

  await deleteStory(params.id, userAuth.id);
  return NextResponse.json({ ok: true });
});
