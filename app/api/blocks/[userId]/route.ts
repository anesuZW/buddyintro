import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { unblockUser } from "@/services/moderation";

export async function DELETE(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  await unblockUser(user.id, params.userId);
  return NextResponse.json({ ok: true });
}
