import { NextResponse } from "next/server";
import { requirePermissionApi, PERMISSIONS } from "@/lib/permissions";
import { getUserRoles } from "@/services/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requirePermissionApi(PERMISSIONS.ROLES_MANAGE);
  if (admin instanceof NextResponse) return admin;
  const [user, roles] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, email: true, profilePicture: true },
    }),
    getUserRoles(params.id),
  ]);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user, roles });
}
