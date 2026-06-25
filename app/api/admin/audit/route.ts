import { NextResponse } from "next/server";
import { requirePermissionApi, PERMISSIONS } from "@/lib/permissions";
import { listAuditLogs, auditLogsToCsv } from "@/services/audit-log";

export async function GET(request: Request) {
  const admin = await requirePermissionApi(PERMISSIONS.AUDIT_VIEW);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  const result = await listAuditLogs({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: Number(searchParams.get("limit") ?? 20),
    action: searchParams.get("action") ?? undefined,
    adminId: searchParams.get("adminId") ?? undefined,
  });

  if (format === "csv") {
    const csv = auditLogsToCsv(result.items);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-logs.csv"`,
      },
    });
  }

  return NextResponse.json(result);
}
