import { NextResponse } from "next/server";
import { getProductionHealthSummary, runHealthChecks } from "@/services/health";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verbose = url.searchParams.get("verbose") === "1";

  if (verbose) {
    const health = await runHealthChecks();
    const code = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;
    return NextResponse.json(health, { status: code });
  }

  const summary = await getProductionHealthSummary();
  const code =
    summary.status === "healthy" ? 200 : summary.status === "degraded" ? 200 : 503;
  return NextResponse.json(summary, { status: code });
}
