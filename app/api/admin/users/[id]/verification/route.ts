import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { grantTrustedUser, setIdentityVerified } from "@/services/verification";
import { logAdminAction } from "@/services/audit-log";
import { trackSecurityEvent, SECURITY_EVENT_TYPES } from "@/services/security-events";

const Schema = z.object({
  trustedUser: z.boolean().optional(),
  identityVerified: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const body = Schema.parse(await request.json());

  if (body.trustedUser !== undefined) {
    const user = await grantTrustedUser(params.id, body.trustedUser);
    const forwarded = request.headers.get("x-forwarded-for");
    await logAdminAction({
      adminId: admin.id,
      action: "user.trusted",
      targetType: "user",
      targetId: params.id,
      metadata: { trustedUser: body.trustedUser },
      ipAddress: forwarded?.split(",")[0]?.trim() ?? null,
    });
    void trackSecurityEvent({
      userId: params.id,
      eventType: SECURITY_EVENT_TYPES.VERIFICATION_CHANGED,
      severity: "medium",
      metadata: { trustedUser: body.trustedUser },
    });
    return NextResponse.json({ user });
  }
  if (body.identityVerified !== undefined) {
    const user = await setIdentityVerified(params.id, body.identityVerified);
    const forwarded = request.headers.get("x-forwarded-for");
    await logAdminAction({
      adminId: admin.id,
      action: "user.identity_verified",
      targetType: "user",
      targetId: params.id,
      metadata: { identityVerified: body.identityVerified },
      ipAddress: forwarded?.split(",")[0]?.trim() ?? null,
    });
    void trackSecurityEvent({
      userId: params.id,
      eventType: SECURITY_EVENT_TYPES.VERIFICATION_CHANGED,
      severity: "medium",
      metadata: { identityVerified: body.identityVerified },
    });
    return NextResponse.json({ user });
  }

  return NextResponse.json({ error: "No changes" }, { status: 400 });
}
