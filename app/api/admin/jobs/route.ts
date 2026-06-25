import { NextResponse } from "next/server";
import { requirePermissionApi, PERMISSIONS } from "@/lib/permissions";
import { listJobs, jobQueueSummary } from "@/services/health";

export async function GET(request: Request) {
  const admin = await requirePermissionApi(PERMISSIONS.JOBS_VIEW);
  if (admin instanceof NextResponse) return admin;
  const { searchParams } = new URL(request.url);
  const [jobs, summary] = await Promise.all([
    listJobs({
      status: searchParams.get("status") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: Number(searchParams.get("limit") ?? 20),
    }),
    jobQueueSummary(),
  ]);
  return NextResponse.json({ ...jobs, summary });
}
