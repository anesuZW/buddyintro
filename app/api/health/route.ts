import { NextResponse } from "next/server";
import {
  getLiteHealthSummary,
  getProductionHealthSummary,
  runHealthChecks,
} from "@/services/health";
import { REQUEST_ID_HEADER } from "@/lib/request-id";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verbose = url.searchParams.get("verbose") === "1";
  const deep = url.searchParams.get("deep") === "1";
  const requestId = request.headers.get(REQUEST_ID_HEADER) ?? undefined;

  // Default: fast ping for load balancers (SELECT 1 only).
  if (!verbose && !deep) {
    const summary = await getLiteHealthSummary({ requestId });
    const code =
      summary.status === "healthy" ? 200 : summary.status === "degraded" ? 200 : 503;
    return NextResponse.json(summary, {
      status: code,
      headers: requestId ? { [REQUEST_ID_HEADER]: requestId } : undefined,
    });
  }

  if (verbose) {
    const health = await runHealthChecks();
    const code = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;
    return NextResponse.json({ ...health, requestId }, {
      status: code,
      headers: requestId ? { [REQUEST_ID_HEADER]: requestId } : undefined,
    });
  }

  const summary = await getProductionHealthSummary({
    verbose: true,
    requestId,
    includeActiveUsers: true,
  });
  const code =
    summary.status === "healthy" ? 200 : summary.status === "degraded" ? 200 : 503;
  return NextResponse.json(summary, {
    status: code,
    headers: requestId ? { [REQUEST_ID_HEADER]: requestId } : undefined,
  });
}
