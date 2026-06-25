import type { RuntimeSnapshot } from "@/lib/perf/runtime-metrics";

export type MetricsSnapshot = RuntimeSnapshot & {
  clientTs: number;
};

export type SnapshotSeries = {
  intervalSec: number;
  snapshots: MetricsSnapshot[];
};

export type MemoryLeakAnalysis = {
  durationSec: number;
  concurrency: number;
  snapshotCount: number;
  heapStartMb: number;
  heapEndMb: number;
  heapGrowthMb: number;
  heapGrowthPct: number;
  rssStartMb: number;
  rssEndMb: number;
  rssGrowthMb: number;
  rssGrowthPct: number;
  heapSlopeMbPerHour: number;
  rssSlopeMbPerHour: number;
  verdict: "stable" | "slow-leak" | "severe-leak";
  notes: string[];
};

export type PrismaRouteProfile = {
  route: string;
  path: string;
  warmRuns: number;
  medianTotalMs: number;
  medianAuthMs: number;
  medianPrismaMs: number;
  medianQueryCount: number;
  topQueries: Array<{ key: string; count: number; totalMs: number; avgMs: number }>;
  issues: string[];
};

export type CapacityRun = {
  concurrency: number;
  durationSec: number;
  mode: "journey";
  stoppedEarly: boolean;
  stopReason?: string;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  rps: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  peakHeapMb: number;
  peakRssMb: number;
  peakCpuPercent: number;
  peakEventLoopLagMs: number;
  avgAuthMs: number;
  startedAt: string;
  endedAt: string;
};

export type CrashEvidence = {
  occurred: boolean;
  exitCode: number | null;
  signal: string | null;
  lastStderrLines: string[];
  lastStdoutLines: string[];
  heapBeforeCrashMb: number | null;
  rssBeforeCrashMb: number | null;
  eventLoopLagBeforeCrashMs: number | null;
  windowsEventLog: string[];
  classification:
    | "none"
    | "out-of-memory"
    | "native-module"
    | "prisma-engine"
    | "unhandled-rejection"
    | "event-loop-starvation"
    | "access-violation"
    | "unknown";
  analysis: string;
};

export type LoadInvestigationResults = {
  generatedAt: string;
  base: string;
  authPoolSize: number;
  quick: boolean;
  baseline: {
    concurrency: number;
    durationSec: number;
    run: import("@/lib/load-test/types").ConcurrencyRun;
    snapshots: SnapshotSeries;
  };
  memoryLeak: MemoryLeakAnalysis & { snapshots: SnapshotSeries };
  prisma: {
    routes: PrismaRouteProfile[];
    staticFindings: string[];
  };
  capacity: {
    levels: number[];
    runs: CapacityRun[];
    stoppedAt: number | null;
    safeConcurrency: number;
    warningZone: string;
    breakingPoint: number | null;
  };
  crash: CrashEvidence;
};
