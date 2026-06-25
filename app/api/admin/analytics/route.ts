import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { analyticsService } from "@/services/analytics/analytics-service";

export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "30");
  const metrics = await analyticsService.queryMetrics({ days });
  return NextResponse.json({ metrics });
}
