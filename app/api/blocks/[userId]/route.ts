import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unblockUser } from "@/services/moderation";

export async function DELETE(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  const user = await requireUser();
  await unblockUser(user.id, params.userId);
  return NextResponse.json({ ok: true });
}
