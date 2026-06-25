import { NextResponse } from "next/server";
import {
  captureRuntimeSnapshot,
  resetRuntimePrismaStats,
} from "@/lib/perf/runtime-metrics";
import { isRuntimeMetricsEnabled } from "@/lib/profile/production-benchmark";

export async function GET(request: Request) {
  if (!isRuntimeMetricsEnabled()) {
    return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("reset") === "prisma") {
    resetRuntimePrismaStats();
    return NextResponse.json({ ok: true, reset: "prisma" });
  }

  const snapshot = captureRuntimeSnapshot();
  return NextResponse.json({
    heapUsed: snapshot.memory.heapUsedMb,
    heapTotal: snapshot.memory.heapTotalMb,
    rss: snapshot.memory.rssMb,
    eventLoopLag: snapshot.eventLoop.lagMeanMs,
    eventLoopLagP99: snapshot.eventLoop.lagP99Ms,
    uptime: snapshot.uptimeSec,
    ts: snapshot.ts,
    prisma: snapshot.prisma,
  });
}
