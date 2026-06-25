import { NextResponse } from "next/server";
import { requirePermissionApi, PERMISSIONS } from "@/lib/permissions";
import {
  listSecurityEvents,
  securityEventTrends,
  securitySeverityBreakdown,
} from "@/services/security-events";

export async function GET(request: Request) {
  const admin = await requirePermissionApi(PERMISSIONS.SECURITY_VIEW);
  if (admin instanceof NextResponse) return admin;
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");

  if (view === "trends") {
    return NextResponse.json({ trends: await securityEventTrends(7) });
  }
  if (view === "breakdown") {
    return NextResponse.json({ breakdown: await securitySeverityBreakdown(30) });
  }

  const result = await listSecurityEvents({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: Number(searchParams.get("limit") ?? 20),
    severity: (searchParams.get("severity") as any) ?? undefined,
    eventType: searchParams.get("eventType") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
  });
  return NextResponse.json(result);
}
