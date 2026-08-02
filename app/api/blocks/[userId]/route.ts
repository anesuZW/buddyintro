import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { unblockUser } from "@/services/moderation";
import { withApiHandler } from "@/lib/api-error";

export const DELETE = withApiHandler(async (
  _request: Request,
  { params }: { params: { userId: string } }
) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  await unblockUser(userAuth.id, params.userId);
  return NextResponse.json({ ok: true });
});
