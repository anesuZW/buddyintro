import { NextResponse } from "next/server";
import { requirePermissionApi, PERMISSIONS } from "@/lib/permissions";
import { listTrustRiskUsers } from "@/services/trust-abuse";

export async function GET(request: Request) {
  const admin = await requirePermissionApi(PERMISSIONS.TRUST_MANAGE);
  if (admin instanceof NextResponse) return admin;
  const { searchParams } = new URL(request.url);
  const result = await listTrustRiskUsers({
    minLevel: (searchParams.get("minLevel") as any) ?? "medium",
    cursor: searchParams.get("cursor") ?? undefined,
    limit: Number(searchParams.get("limit") ?? 20),
  });
  return NextResponse.json(result);
}
