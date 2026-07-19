import { NextResponse } from "next/server";
import { renderPrometheusMetrics } from "@/lib/metrics";

/** Prometheus-compatible metrics endpoint. Protect at nginx in production. */
export async function GET() {
  const body = renderPrometheusMetrics();
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
