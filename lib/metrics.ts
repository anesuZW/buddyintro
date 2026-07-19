import "server-only";

type Counter = { name: string; help: string; labels: string[]; values: Map<string, number> };
type Histogram = {
  name: string;
  help: string;
  labels: string[];
  buckets: number[];
  values: Map<string, number[]>;
};

const counters: Counter[] = [
  { name: "http_requests_total", help: "Total HTTP requests", labels: ["method", "route", "status"], values: new Map() },
  { name: "worker_jobs_total", help: "Background worker jobs processed", labels: ["queue", "status"], values: new Map() },
  { name: "media_uploads_total", help: "Media uploads", labels: ["kind"], values: new Map() },
  { name: "media_downloads_total", help: "Media downloads", labels: ["kind"], values: new Map() },
];

const histograms: Histogram[] = [
  {
    name: "http_request_duration_seconds",
    help: "HTTP request duration",
    labels: ["method", "route"],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    values: new Map(),
  },
  {
    name: "database_query_duration_seconds",
    help: "Database query duration",
    labels: ["operation"],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
    values: new Map(),
  },
];

const gauges: Map<string, number> = new Map([
  ["process_memory_bytes", 0],
  ["process_cpu_user_seconds", 0],
  ["queue_length", 0],
  ["active_sessions", 0],
  ["websocket_connections", 0],
]);

function labelKey(labels: Record<string, string>): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
}

export function incrementCounter(name: string, labels: Record<string, string> = {}, amount = 1) {
  const counter = counters.find((c) => c.name === name);
  if (!counter) return;
  const key = labelKey(labels);
  counter.values.set(key, (counter.values.get(key) ?? 0) + amount);
}

export function observeHistogram(name: string, valueSeconds: number, labels: Record<string, string> = {}) {
  const hist = histograms.find((h) => h.name === name);
  if (!hist) return;
  const key = labelKey(labels);
  const arr = hist.values.get(key) ?? [];
  arr.push(valueSeconds);
  if (arr.length > 1000) arr.shift();
  hist.values.set(key, arr);
}

export function setGauge(name: string, value: number) {
  gauges.set(name, value);
}

export function recordHttpRequest(method: string, route: string, status: number, durationMs: number) {
  incrementCounter("http_requests_total", {
    method,
    route,
    status: String(status),
  });
  observeHistogram("http_request_duration_seconds", durationMs / 1000, { method, route });
}

export function recordDatabaseQuery(operation: string, durationMs: number) {
  observeHistogram("database_query_duration_seconds", durationMs / 1000, { operation });
}

export function recordMediaUpload(kind: string) {
  incrementCounter("media_uploads_total", { kind });
}

export function recordMediaDownload(kind: string) {
  incrementCounter("media_downloads_total", { kind });
}

export function recordWorkerJob(queue: string, status: string) {
  incrementCounter("worker_jobs_total", { queue, status });
}

export function refreshProcessGauges() {
  const mem = process.memoryUsage();
  setGauge("process_memory_bytes", mem.rss);
  const cpu = process.cpuUsage();
  setGauge("process_cpu_user_seconds", cpu.user / 1e6);
}

function formatHistogram(hist: Histogram): string {
  const lines: string[] = [];
  lines.push(`# HELP ${hist.name} ${hist.help}`);
  lines.push(`# TYPE ${hist.name} histogram`);
  for (const [labelStr, samples] of hist.values) {
    for (const bucket of hist.buckets) {
      const count = samples.filter((v) => v <= bucket).length;
      lines.push(`${hist.name}_bucket{${labelStr},le="${bucket}"} ${count}`);
    }
    lines.push(`${hist.name}_bucket{${labelStr},le="+Inf"} ${samples.length}`);
    lines.push(`${hist.name}_count{${labelStr}} ${samples.length}`);
    const sum = samples.reduce((a, b) => a + b, 0);
    lines.push(`${hist.name}_sum{${labelStr}} ${sum}`);
  }
  return lines.join("\n");
}

/** Prometheus text exposition format. */
export function renderPrometheusMetrics(): string {
  refreshProcessGauges();
  const lines: string[] = [];

  for (const counter of counters) {
    lines.push(`# HELP ${counter.name} ${counter.help}`);
    lines.push(`# TYPE ${counter.name} counter`);
    for (const [labelStr, value] of counter.values) {
      lines.push(`${counter.name}{${labelStr}} ${value}`);
    }
  }

  for (const hist of histograms) {
    if (hist.values.size) lines.push(formatHistogram(hist));
  }

  for (const [name, value] of gauges) {
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name} ${value}`);
  }

  return `${lines.join("\n")}\n`;
}
