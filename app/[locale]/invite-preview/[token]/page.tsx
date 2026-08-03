import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { BRAND } from "@/lib/branding";
import {
  buildInviteOpenGraph,
  getInvitePreviewByToken,
} from "@/lib/invite-preview";
import { recordInvitationOpened } from "@/services/invites";
import { InvitePreviewViewer } from "@/components/invite/InvitePreviewViewer";
import {
  INVITE_COOKIE_MAX_AGE,
  INVITE_EMAIL_COOKIE,
  INVITE_SESSION_COOKIE,
} from "@/lib/invite-session";

type Props = { params: { token: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const preview = await getInvitePreviewByToken(params.token);
  if (preview.status !== "ok") {
    return {
      title: `${BRAND.name} invite`,
      description: `View your ${BRAND.name} story invitation.`,
    };
  }

  return buildInviteOpenGraph({
    token: params.token,
    inviterName: preview.inviter.name,
    relationshipLabel: preview.relationshipLabel,
    storyText: preview.story.text,
  });
}

function setInviteCookies(token: string, email?: string | null) {
  const jar = cookies();
  jar.set(INVITE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: INVITE_COOKIE_MAX_AGE,
    path: "/",
  });
  if (email) {
    jar.set(INVITE_EMAIL_COOKIE, email, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: INVITE_COOKIE_MAX_AGE,
      path: "/",
    });
  }
}

export default async function InvitePreviewPage({ params }: Props) {
  const preview = await getInvitePreviewByToken(params.token);

  if (preview.status === "not_found") {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6 bg-background">
        <div className="card p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold">Invite not found</h1>
          <p className="mt-2 text-muted-foreground">
            This preview link is invalid or has expired.
          </p>
          <Link href="/signup" className="btn-primary mt-6 inline-flex">
            Sign up
          </Link>
        </div>
      </main>
    );
  }

  if (preview.status === "expired") {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6 bg-background">
        <div className="card p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold">Invite expired</h1>
          <p className="mt-2 text-muted-foreground">
            This story preview is no longer available.
          </p>
          <Link href="/signup" className="btn-primary mt-6 inline-flex">
            Sign up anyway
          </Link>
        </div>
      </main>
    );
  }

  if (preview.status === "registered") {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6 bg-background">
        <div className="card p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold">You&apos;re already in</h1>
          <p className="mt-2 text-muted-foreground">
            This invite was already accepted. Log in to continue.
          </p>
          <Link href="/login" className="btn-primary mt-6 inline-flex">
            Log in
          </Link>
        </div>
      </main>
    );
  }

  setInviteCookies(preview.inviteToken, preview.email);
  await recordInvitationOpened(preview.inviteToken);

  return (
    <InvitePreviewViewer
      story={{
        id: preview.story.id,
        mediaUrl: preview.story.mediaUrl,
        mediaType: preview.story.mediaType,
        voiceNoteUrl: preview.story.voiceNoteUrl,
        text: preview.story.text,
      }}
      inviter={preview.inviter}
      inviteToken={preview.inviteToken}
    />
  );
}
