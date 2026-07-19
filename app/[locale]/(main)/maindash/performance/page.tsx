import { PerformanceDashboard } from "@/components/admin/PerformanceDashboard";

export default function PerformancePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Performance</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Route timing, API latency, Prisma query counts, and slow-query tracking.
      </p>
      <div className="mt-6">
        <PerformanceDashboard />
      </div>
    </div>
  );
}
