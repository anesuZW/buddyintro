import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { analyticsService } from "@/services/analytics/analytics-service";
import { RouteProfiler } from "@/lib/profile/route-profiler";
import { runWithAuthProfile } from "@/lib/auth-profile";

export async function GET() {
  return runWithAuthProfile(async () => {
  const p = new RouteProfiler("/api/profile/insights");

  const user = await p.time("auth", async () => {
    const u = await getCurrentUser();
    if (!u) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    return u;
  });

  const insights = await p.time("queryInsights", () =>
    analyticsService.queryUserInsights(user.id)
  );

  const payload = { insights };
  await p.time("serialize", async () => JSON.stringify(payload));
  p.finish();
  return p.finishResponse(NextResponse.json(payload));
  });
}
