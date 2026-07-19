import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { readDeploymentBuildInfo } from "@/lib/server/deployment-info";

export async function GET() {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;

  const deployment = readDeploymentBuildInfo();
  if (!deployment) {
    return NextResponse.json({ error: "Deployment manifest not found" }, { status: 404 });
  }

  return NextResponse.json({
    deployment,
    nodeVersion: process.version,
    uptimeSec: Math.round(process.uptime()),
    generatedAt: new Date().toISOString(),
  });
}
