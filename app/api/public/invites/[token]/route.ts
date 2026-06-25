import { NextResponse } from "next/server";
import { getInvitePreviewByToken } from "@/lib/invite-preview";
import { recordInvitationOpened } from "@/services/invites";
import {
  INVITE_COOKIE_MAX_AGE,
  INVITE_EMAIL_COOKIE,
  INVITE_SESSION_COOKIE,
} from "@/lib/invite-session";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const preview = await getInvitePreviewByToken(params.token);

  if (preview.status === "not_found") {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (preview.status === "expired") {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }
  if (preview.status === "registered") {
    return NextResponse.json({ error: "Invite already accepted" }, { status: 409 });
  }

  await recordInvitationOpened(params.token);

  const response = NextResponse.json({
    email: preview.email,
    phoneNumber: preview.phoneNumber,
    inviteToken: preview.inviteToken,
    inviter: preview.inviter,
    story: {
      id: preview.story.id,
      mediaUrl: preview.story.mediaUrl,
      mediaType: preview.story.mediaType,
      voiceNoteUrl: preview.story.voiceNoteUrl,
      text: preview.story.text,
    },
  });

  response.cookies.set(INVITE_SESSION_COOKIE, preview.inviteToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: INVITE_COOKIE_MAX_AGE,
    path: "/",
  });
  if (preview.email) {
    response.cookies.set(INVITE_EMAIL_COOKIE, preview.email, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: INVITE_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  return response;
}
