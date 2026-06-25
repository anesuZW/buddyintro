import { NextResponse } from "next/server";
import { readPageBenchmarkMetrics } from "@/lib/profile/production-benchmark";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (process.env.PROFILE_PRODUCTION !== "1") {
    return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  }

  const metrics = readPageBenchmarkMetrics(params.id);
  if (!metrics) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(metrics);
}
