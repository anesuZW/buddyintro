import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";

import { deleteStory, getStoryForViewer } from "@/services/stories";

import { analyticsService } from "@/services/analytics/analytics-service";

import { ANALYTICS_EVENTS } from "@/lib/analytics-events";



export async function GET(

  _req: Request,

  { params }: { params: { id: string } }

) {

  const user = await requireUser();

  const story = await getStoryForViewer(params.id, user.id);

  if (!story) {

    return NextResponse.json({ error: "Not found" }, { status: 404 });

  }

  void analyticsService.track({

    userId: user.id,

    eventType: ANALYTICS_EVENTS.INTRODUCTION_VIEWED,

    entityType: "story",

    entityId: params.id,

  });

  return NextResponse.json({ story });

}



export async function DELETE(

  _req: Request,

  { params }: { params: { id: string } }

) {

  const user = await requireUser();

  await deleteStory(params.id, user.id);

  return NextResponse.json({ ok: true });

}

