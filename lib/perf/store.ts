import "server-only";

/** In-memory performance ring buffer for admin dashboard (resets on deploy). */

export type SlowQueryRecord = {
  model: string;
  action: string;
  durationMs: number;
  timestamp: number;
};

export type PerfRecord = {
  id: string;
  kind: "route" | "api" | "page";
  label: string;
  method?: string;
  durationMs: number;
  queryCount: number;
  connectMs?: number;
  slowQueries: SlowQueryRecord[];
  timestamp: number;
  status?: number;
};

const MAX_RECORDS = 500;
const records: PerfRecord[] = [];
let querySeq = 0;

function trim() {
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function recordPerf(entry: Omit<PerfRecord, "id" | "timestamp">) {
  records.push({
    ...entry,
    id: `${Date.now()}-${++querySeq}`,
    timestamp: Date.now(),
  });
  trim();
}

export function recordSlowQuery(q: Omit<SlowQueryRecord, "timestamp">) {
  // Attach to most recent record if within same request window — stored globally for dashboard
  const rec: SlowQueryRecord = { ...q, timestamp: Date.now() };
  if (records.length) {
    const last = records[records.length - 1];
    last.slowQueries.push(rec);
    if (last.slowQueries.length > 20) last.slowQueries.shift();
  }
}

export function getPerfRecords(limit = 100): PerfRecord[] {
  return records.slice(-limit).reverse();
}

export function getPerfSummary() {
  const recent = records.slice(-200);
  if (!recent.length) {
    return {
      totalRequests: 0,
      avgDurationMs: 0,
      avgQueryCount: 0,
      slowestRoutes: [] as Array<{ label: string; avgMs: number; count: number }>,
      slowestApis: [] as Array<{ label: string; avgMs: number; count: number }>,
      topSlowQueries: [] as Array<{ model: string; action: string; avgMs: number; count: number }>,
    };
  }

  const byLabel = new Map<string, { totalMs: number; count: number; kind: string }>();
  const slowQueryMap = new Map<string, { totalMs: number; count: number }>();

  for (const r of recent) {
    const key = `${r.kind}:${r.label}`;
    const prev = byLabel.get(key) ?? { totalMs: 0, count: 0, kind: r.kind };
    prev.totalMs += r.durationMs;
    prev.count += 1;
    byLabel.set(key, prev);

    for (const sq of r.slowQueries) {
      const qk = `${sq.model}.${sq.action}`;
      const qp = slowQueryMap.get(qk) ?? { totalMs: 0, count: 0 };
      qp.totalMs += sq.durationMs;
      qp.count += 1;
      slowQueryMap.set(qk, qp);
    }
  }

  const toRanked = (kind: string) =>
    [...byLabel.entries()]
      .filter(([, v]) => v.kind === kind)
      .map(([label, v]) => ({
        label: label.replace(`${kind}:`, ""),
        avgMs: Math.round(v.totalMs / v.count),
        count: v.count,
      }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 10);

  return {
    totalRequests: recent.length,
    avgDurationMs: Math.round(recent.reduce((s, r) => s + r.durationMs, 0) / recent.length),
    avgQueryCount: Math.round(recent.reduce((s, r) => s + r.queryCount, 0) / recent.length),
    slowestRoutes: toRanked("page"),
    slowestApis: toRanked("api"),
    topSlowQueries: [...slowQueryMap.entries()]
      .map(([key, v]) => {
        const [model, action] = key.split(".");
        return { model, action, avgMs: Math.round(v.totalMs / v.count), count: v.count };
      })
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 10),
  };
}
