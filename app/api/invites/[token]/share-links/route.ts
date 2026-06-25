import { NextResponse } from "next/server";
import { z } from "zod";
import type { InviteMethod } from "@prisma/client";
import { buildInviteShareLinks } from "@/lib/invite-share";
import { prisma } from "@/lib/prisma";
import { setInvitationShareMethod } from "@/services/invites";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const invitation = await prisma.invitation.findUnique({
    where: { inviteToken: params.token },
  });
  if (!invitation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const links = buildInviteShareLinks({
    token: invitation.inviteToken,
    phoneNumber: invitation.phoneNumber,
  });

  return NextResponse.json(links);
}

const MethodSchema = z.object({
  method: z.enum(["whatsapp", "sms", "imessage"]),
});

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  const parsed = MethodSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  }

  await setInvitationShareMethod(params.token, parsed.data.method as InviteMethod);
  return NextResponse.json({ ok: true });
}
