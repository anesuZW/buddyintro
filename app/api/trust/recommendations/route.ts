import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTrustRecommendations } from "@/services/trust-recommendations";
import { withPerfApi } from "@/lib/perf/with-perf";
import { RouteProfiler } from "@/lib/profile/route-profiler";

async function handleGet() {
  const p = new RouteProfiler("/api/trust/recommendations");

  const user = await p.time("auth", async () => {
    const u = await getCurrentUser();
    if (!u) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    return u;
  });

  const recommendations = await p.time("trustCalculation", () =>
    getTrustRecommendations(user.id)
  );

  const payload = { recommendations };
  await p.time("serialize", async () => JSON.stringify(payload));

  p.finish();
  return p.finishResponse(NextResponse.json(payload));
}

export const GET = withPerfApi("/api/trust/recommendations", handleGet);
