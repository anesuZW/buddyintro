import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { getTrustRecommendations } from "@/services/trust-recommendations";
import { RouteProfiler } from "@/lib/profile/route-profiler";
import { withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async () => {
  const p = new RouteProfiler("/api/trust/recommendations");

  const userAuth = await p.time("auth", () => requireUserApi());
  if (isApiAuthError(userAuth)) return userAuth;
  const user = userAuth;

  const recommendations = await p.time("trustCalculation", () =>
    getTrustRecommendations(user.id)
  );

  const payload = { recommendations };
  await p.time("serialize", async () => JSON.stringify(payload));

  p.finish();
  return p.finishResponse(NextResponse.json(payload));
});
