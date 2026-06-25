import type { MetricsSnapshot, SnapshotSeries } from "@/lib/load-test/investigation-types";
import type { RuntimeSnapshot } from "@/lib/perf/runtime-metrics";

export class MetricsCollector {
  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshots: MetricsSnapshot[] = [];
  private readonly base: string;
  private readonly intervalSec: number;
  private cookie: string | null = null;

  constructor(base: string, intervalSec = 5, cookie?: string) {
    this.base = base.replace(/\/$/, "");
    this.intervalSec = intervalSec;
    this.cookie = cookie ?? null;
  }

  setCookie(cookie: string): void {
    this.cookie = cookie;
  }

  async fetchSnapshot(): Promise<RuntimeSnapshot | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.cookie) headers.Cookie = this.cookie;
      const res = await fetch(`${this.base}/api/bench/runtime`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text.startsWith("{")) return null;
      return JSON.parse(text) as RuntimeSnapshot;
    } catch {
      return null;
    }
  }

  async resetPrismaStats(): Promise<void> {
    try {
      const headers: Record<string, string> = {};
      if (this.cookie) headers.Cookie = this.cookie;
      await fetch(`${this.base}/api/bench/runtime?reset=prisma`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      /* ignore */
    }
  }

  start(): void {
    if (this.timer) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.intervalSec * 1000);
  }

  stop(): SnapshotSeries {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    return {
      intervalSec: this.intervalSec,
      snapshots: [...this.snapshots],
    };
  }

  getSnapshots(): MetricsSnapshot[] {
    return [...this.snapshots];
  }

  private async poll(): Promise<void> {
    const snap = await this.fetchSnapshot();
    if (!snap) return;
    this.snapshots.push({ ...snap, clientTs: Date.now() });
  }
}

export function summarizeSnapshots(snapshots: MetricsSnapshot[]) {
  if (!snapshots.length) {
    return {
      peakHeapMb: 0,
      peakRssMb: 0,
      peakCpuPercent: 0,
      peakEventLoopLagMs: 0,
      avgAuthMs: 0,
      avgPrismaQueries: 0,
    };
  }

  return {
    peakHeapMb: Math.max(...snapshots.map((s) => s.memory.heapUsedMb)),
    peakRssMb: Math.max(...snapshots.map((s) => s.memory.rssMb)),
    peakCpuPercent: Math.max(...snapshots.map((s) => s.cpu.percent)),
    peakEventLoopLagMs: Math.max(...snapshots.map((s) => s.eventLoop.lagMaxMs)),
    avgAuthMs: Math.round(
      snapshots.reduce((sum, s) => sum + s.auth.avgMiddlewareMs, 0) / snapshots.length
    ),
    avgPrismaQueries: Math.round(
      snapshots.reduce((sum, s) => sum + s.prisma.totalQueries, 0) / snapshots.length
    ),
  };
}

export function analyzeMemoryLeak(
  snapshots: MetricsSnapshot[],
  durationSec: number,
  concurrency: number
): import("@/lib/load-test/investigation-types").MemoryLeakAnalysis {
  const notes: string[] = [];
  if (snapshots.length < 2) {
    return {
      durationSec,
      concurrency,
      snapshotCount: snapshots.length,
      heapStartMb: 0,
      heapEndMb: 0,
      heapGrowthMb: 0,
      heapGrowthPct: 0,
      rssStartMb: 0,
      rssEndMb: 0,
      rssGrowthMb: 0,
      rssGrowthPct: 0,
      heapSlopeMbPerHour: 0,
      rssSlopeMbPerHour: 0,
      verdict: "stable",
      notes: [
        snapshots.length
          ? "Only one snapshot — insufficient trend data"
          : "No runtime snapshots (restart server after build so /api/bench/runtime is available)",
      ],
    };
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const warmupSkip = Math.max(1, Math.floor(snapshots.length * 0.2));
  const trendStart = snapshots[warmupSkip] ?? first;
  const trendEnd = last;

  const heapStartMb = trendStart.memory.heapUsedMb;
  const heapEndMb = trendEnd.memory.heapUsedMb;
  const heapGrowthMb = Math.round((heapEndMb - heapStartMb) * 10) / 10;
  const heapGrowthPct =
    heapStartMb > 0 ? Math.round((heapGrowthMb / heapStartMb) * 1000) / 10 : 0;

  const rssStartMb = trendStart.memory.rssMb;
  const rssEndMb = trendEnd.memory.rssMb;
  const rssGrowthMb = Math.round((rssEndMb - rssStartMb) * 10) / 10;
  const rssGrowthPct =
    rssStartMb > 0 ? Math.round((rssGrowthMb / rssStartMb) * 1000) / 10 : 0;

  const trendDurationSec = Math.max(
    60,
    Math.round(((trendEnd.ts - trendStart.ts) / 1000) * 10) / 10
  );
  const hours = trendDurationSec / 3600;
  const heapSlopeMbPerHour = hours > 0 ? Math.round((heapGrowthMb / hours) * 10) / 10 : 0;
  const rssSlopeMbPerHour = hours > 0 ? Math.round((rssGrowthMb / hours) * 10) / 10 : 0;

  let verdict: "stable" | "slow-leak" | "severe-leak" = "stable";
  if (durationSec < 900) {
    notes.push("Test window under 15 minutes — trend is indicative only");
  }
  if (rssSlopeMbPerHour > 80 && durationSec >= 900) {
    verdict = "severe-leak";
    notes.push("RSS growth slope exceeds severe threshold after warmup");
  } else if (rssSlopeMbPerHour > 25 && durationSec >= 900) {
    verdict = "slow-leak";
    notes.push("Gradual RSS growth after warmup — monitor in production");
  } else if (rssGrowthMb > 100 && durationSec < 900) {
    notes.push("RSS spike during load ramp-up — not classified as leak until sustained window");
  } else {
    notes.push("Memory within expected variance for sustained load (post-warmup)");
  }

  return {
    durationSec,
    concurrency,
    snapshotCount: snapshots.length,
    heapStartMb: first.memory.heapUsedMb,
    heapEndMb: last.memory.heapUsedMb,
    heapGrowthMb: Math.round((last.memory.heapUsedMb - first.memory.heapUsedMb) * 10) / 10,
    heapGrowthPct:
      first.memory.heapUsedMb > 0
        ? Math.round(
            ((last.memory.heapUsedMb - first.memory.heapUsedMb) / first.memory.heapUsedMb) *
              1000
          ) / 10
        : 0,
    rssStartMb: first.memory.rssMb,
    rssEndMb: last.memory.rssMb,
    rssGrowthMb: Math.round((last.memory.rssMb - first.memory.rssMb) * 10) / 10,
    rssGrowthPct:
      first.memory.rssMb > 0
        ? Math.round(((last.memory.rssMb - first.memory.rssMb) / first.memory.rssMb) * 1000) / 10
        : 0,
    heapSlopeMbPerHour,
    rssSlopeMbPerHour,
    verdict,
    notes,
  };
}
