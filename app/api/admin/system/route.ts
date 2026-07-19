import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getProductionHealthSummary } from "@/services/health";
import { getWorkerStatus } from "@/services/worker-status";
import { queryStorageAnalytics } from "@/services/media/storage-analytics";

export async function GET() {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;

  const [health, worker, storage, deploymentModule] = await Promise.all([
    getProductionHealthSummary({ verbose: true }),
    getWorkerStatus(),
    queryStorageAnalytics(7).catch(() => null),
    import("@/lib/server/deployment-info"),
  ]);

  const deployment = deploymentModule.readDeploymentBuildInfo();

  return NextResponse.json({
    health,
    worker,
    storage,
    deployment,
    pm2: {
      note: "PM2 status is reported by the host agent; query pm2 jlist on the server",
    },
    generatedAt: new Date().toISOString(),
  });
}
