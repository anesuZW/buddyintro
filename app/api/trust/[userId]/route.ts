import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";

import { getTrustProfile } from "@/services/trust-profile";

import { analyticsService } from "@/services/analytics/analytics-service";

import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

import { canViewTrustProfile } from "@/lib/access-control";



export async function GET(

  _request: Request,

  { params }: { params: { userId: string } }

) {

  const viewer = await requireUser();

  if (!(await canViewTrustProfile(viewer.id, params.userId))) {

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  }

  void analyticsService.track({

    userId: viewer.id,

    eventType: ANALYTICS_EVENTS.TRUST_PROFILE_VIEWED,

    entityType: "user",

    entityId: params.userId,

  });

  const trustProfile = await getTrustProfile(viewer.id, params.userId);

  return NextResponse.json({ trustProfile });

}

