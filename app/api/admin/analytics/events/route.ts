import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { analyticsService } from "@/services/analytics/analytics-service";
import { clampLimit } from "@/lib/pagination";

export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "30");
  const cursor = searchParams.get("cursor") ?? undefined;
  const eventType = searchParams.get("eventType") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const limit = clampLimit(Number(searchParams.get("limit") ?? undefined));

  const result = await analyticsService.listEvents({
    days,
    cursor,
    eventType,
    userId,
    limit,
  });

  return NextResponse.json(result);
}
