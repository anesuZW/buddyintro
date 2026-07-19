import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { analyzeDatabasePerformance } from "@/services/database-analysis";

export async function GET() {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const recommendations = await analyzeDatabasePerformance();
  return NextResponse.json({ recommendations, generatedAt: new Date().toISOString() });
}
