"use client";

import { useEffect, useState } from "react";

type StorageAnalytics = {
  totals: {
    files: number;
    bytes: number;
    images: number;
    videos: number;
    audio: number;
    thumbnails: number;
  };
  mediaObjects: {
    total: number;
    pending: number;
    processing: number;
    ready: number;
    failed: number;
    deduplicatedRefs: number;
  };
  averages: {
    uploadBytes: number;
    compressionSavingsBytes: number;
  };
  largestUsers: Array<{ userId: string; bytes: number; files: number }>;
  topConsumers: Array<{ userId: string; bytes: number; count: number }>;
  dailyUploads: Array<{ date: string; count: number; bytes: number }>;
  growth: Array<{ date: string; cumulativeBytes: number }>;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StorageDashboard() {
  const [analytics, setAnalytics] = useState<StorageAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/storage?days=30")
      .then((res) => res.json())
      .then((data) => {
        if (data.analytics) setAnalytics(data.analytics);
        else setError(data.error ?? "Failed to load storage analytics");
      })
      .catch(() => setError("Failed to load storage analytics"));
  }, []);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!analytics) return <p className="text-muted-foreground">Loading storage analytics…</p>;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total storage" value={formatBytes(analytics.totals.bytes)} />
        <StatCard label="Media files" value={String(analytics.totals.files)} />
        <StatCard label="Avg upload" value={formatBytes(analytics.averages.uploadBytes)} />
        <StatCard
          label="Compression savings"
          value={formatBytes(analytics.averages.compressionSavingsBytes)}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Images" value={String(analytics.totals.images)} />
        <StatCard label="Videos" value={String(analytics.totals.videos)} />
        <StatCard label="Audio" value={String(analytics.totals.audio)} />
        <StatCard label="Thumbnails" value={String(analytics.totals.thumbnails)} />
        <StatCard label="Dedup refs" value={String(analytics.mediaObjects.deduplicatedRefs)} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending jobs" value={String(analytics.mediaObjects.pending)} />
        <StatCard label="Processing" value={String(analytics.mediaObjects.processing)} />
        <StatCard label="Ready" value={String(analytics.mediaObjects.ready)} />
        <StatCard label="Failed" value={String(analytics.mediaObjects.failed)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <RankedTable
          title="Largest users (filesystem)"
          rows={analytics.largestUsers.map((row) => ({
            id: row.userId,
            primary: row.userId.slice(0, 8),
            secondary: formatBytes(row.bytes),
            meta: `${row.files} files`,
          }))}
        />
        <RankedTable
          title="Top uploaders (30d)"
          rows={analytics.topConsumers.map((row) => ({
            id: row.userId,
            primary: row.userId.slice(0, 8),
            secondary: formatBytes(row.bytes),
            meta: `${row.count} uploads`,
          }))}
        />
      </section>

      <section>
        <h3 className="font-medium mb-2">Daily uploads (30d)</h3>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2">Date</th>
                <th className="p-2">Uploads</th>
                <th className="p-2">Bytes</th>
              </tr>
            </thead>
            <tbody>
              {analytics.dailyUploads.slice(-14).map((day) => (
                <tr key={day.date} className="border-b last:border-0">
                  <td className="p-2">{day.date}</td>
                  <td className="p-2">{day.count}</td>
                  <td className="p-2">{formatBytes(day.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function RankedTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; primary: string; secondary: string; meta: string }>;
}) {
  return (
    <div className="rounded-lg border">
      <h3 className="font-medium p-4 border-b">{title}</h3>
      <ul>
        {rows.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No data yet</li>
        ) : (
          rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between p-3 border-b last:border-0 text-sm">
              <span>{row.primary}</span>
              <span className="text-muted-foreground">{row.meta}</span>
              <span className="font-medium">{row.secondary}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
