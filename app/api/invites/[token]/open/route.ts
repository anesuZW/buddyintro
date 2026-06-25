import { NextResponse } from "next/server";
import { recordInvitationOpened } from "@/services/invites";

export async function POST(
  _request: Request,
  { params }: { params: { token: string } }
) {
  await recordInvitationOpened(params.token);
  return NextResponse.json({ ok: true });
}
