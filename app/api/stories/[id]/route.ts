import { NextResponse } from "next/server";

import { requireUserApi, isApiAuthError } from "@/lib/auth";

import { deleteStory, getStoryForViewer } from "@/services/stories";

import { analyticsService } from "@/services/analytics/analytics-service";

import { ANALYTICS_EVENTS } from "@/lib/analytics-events";



export async function GET(

  _req: Request,

  { params }: { params: { id: string } }

) {

  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;

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

  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;

  await deleteStory(params.id, user.id);

  return NextResponse.json({ ok: true });

}

