import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getWorkerStatus } from "@/services/worker-status";
import { listJobs, jobQueueSummary } from "@/services/health";
import { MEDIA_QUEUE_NAME } from "@/services/media/media-queue";

export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const [worker, summary, jobs] = await Promise.all([
    getWorkerStatus(),
    jobQueueSummary(),
    listJobs({
      status: searchParams.get("status") ?? undefined,
      limit: Number(searchParams.get("limit") ?? 20),
    }),
  ]);

  return NextResponse.json({
    queueName: MEDIA_QUEUE_NAME,
    worker,
    summary,
    jobs,
  });
}
