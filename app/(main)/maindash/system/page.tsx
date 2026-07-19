"use client";

import { useEffect, useState } from "react";

type SystemPayload = {
  health: {
    status: string;
    database: string;
    redis: string;
    storage: string;
    queue: string;
    worker: string;
    memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
    disk?: { totalGb: number; freeGb: number; usedPercent: number };
    uptime: number;
    nodeVersion: string;
    buildVersion?: string;
    gitCommit?: string;
    activeUsers24h?: number;
    deployment?: { version: string; gitCommit: string; deploymentId?: string };
    details?: Record<string, string | number | boolean>;
  };
  worker: {
    healthy: boolean;
    lastHeartbeat: string | null;
    media: { pending: number; processing: number; failed: number; deadLetter: number };
    bullmq?: { waiting: number; active: number; failed: number };
  };
  storage?: { totals: { bytes: number; files: number } };
  generatedAt: string;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-1 capitalize">{value}</p>
    </div>
  );
}

export default function SystemMonitoringPage() {
  const [data, setData] = useState<SystemPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/admin/system")
        .then((r) => r.json())
        .then((payload) => {
          if (payload.health) setData(payload);
          else setError(payload.error ?? "Failed to load system metrics");
        })
        .catch(() => setError("Failed to load system metrics"));
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading system metrics…</p>;

  const { health, worker, storage } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">System monitoring</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Updated {new Date(data.generatedAt).toLocaleString()} · Node {health.nodeVersion}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Overall" value={health.status} />
        <Stat label="Database" value={health.database} />
        <Stat label="Redis" value={health.redis} />
        <Stat label="Worker" value={health.worker} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Memory (RSS)" value={`${health.memory.rssMb} MB`} />
        <Stat label="Heap used" value={`${health.memory.heapUsedMb} MB`} />
        <Stat label="Uptime" value={`${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`} />
        <Stat label="Build" value={health.deployment?.version ?? health.buildVersion ?? "unknown"} />
      </section>

      {health.disk && (
        <section className="rounded-lg border p-4">
          <h2 className="font-medium mb-2">Disk</h2>
          <p className="text-sm">
            {health.disk.freeGb} GB free of {health.disk.totalGb} GB ({health.disk.usedPercent}% used)
          </p>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="font-medium mb-2">Media worker</h2>
          <ul className="text-sm space-y-1">
            <li>Healthy: {worker.healthy ? "yes" : "no"}</li>
            <li>Pending: {worker.media.pending}</li>
            <li>Processing: {worker.media.processing}</li>
            <li>Failed: {worker.media.failed}</li>
            <li>Dead letter: {worker.media.deadLetter}</li>
            <li>Last heartbeat: {worker.lastHeartbeat ?? "none"}</li>
          </ul>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-medium mb-2">Deployment</h2>
          <ul className="text-sm space-y-1">
            <li>Version: {health.deployment?.version ?? "—"}</li>
            <li>Commit: {health.deployment?.gitCommit?.slice(0, 12) ?? health.gitCommit?.slice(0, 12) ?? "—"}</li>
            <li>Deploy ID: {health.deployment?.deploymentId ?? "—"}</li>
            <li>Active users (24h): {health.activeUsers24h ?? "—"}</li>
            {storage && <li>Storage files: {storage.totals.files}</li>}
          </ul>
        </div>
      </section>

      {health.details && (
        <section className="rounded-lg border p-4">
          <h2 className="font-medium mb-2">Diagnostics</h2>
          <dl className="grid sm:grid-cols-2 gap-2 text-sm">
            {Object.entries(health.details).map(([key, value]) => (
              <div key={key}>
                <dt className="text-muted-foreground">{key}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
