import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { queryStorageAnalytics } from "@/services/media/storage-analytics";

export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "30");
  const analytics = await queryStorageAnalytics(days);
  return NextResponse.json({ analytics });
}
