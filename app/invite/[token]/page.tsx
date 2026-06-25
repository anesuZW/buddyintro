import Link from "next/link";
import { getInvitePreviewByToken, invitePreviewUrl } from "@/lib/invite-preview";
import { recordInvitationOpened } from "@/services/invites";
import { InviteLandingClient } from "@/components/invite/InviteLandingClient";
import {
  INVITE_COOKIE_MAX_AGE,
  INVITE_EMAIL_COOKIE,
  INVITE_SESSION_COOKIE,
} from "@/lib/invite-session";
import { cookies } from "next/headers";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const preview = await getInvitePreviewByToken(params.token);

  if (preview.status === "not_found") {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6">
        <div className="card p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold">Invite not found</h1>
          <p className="mt-2 text-muted-foreground">
            This invite link is invalid or has expired.
          </p>
          <Link href="/signup" className="btn-primary mt-6 inline-flex">
            Sign up anyway
          </Link>
        </div>
      </main>
    );
  }

  if (preview.status === "expired") {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6">
        <div className="card p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold">Invite expired</h1>
          <p className="mt-2 text-muted-foreground">
            This invite is no longer valid.
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
      <main className="min-h-dvh flex items-center justify-center px-6">
        <div className="card p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold">You&apos;re already in</h1>
          <p className="mt-2 text-muted-foreground">
            This invite has been accepted. Just log in to continue.
          </p>
          <Link href="/login" className="btn-primary mt-6 inline-flex">
            Log in
          </Link>
        </div>
      </main>
    );
  }

  const jar = cookies();
  jar.set(INVITE_SESSION_COOKIE, preview.inviteToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: INVITE_COOKIE_MAX_AGE,
    path: "/",
  });
  if (preview.email) {
    jar.set(INVITE_EMAIL_COOKIE, preview.email, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: INVITE_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  await recordInvitationOpened(preview.inviteToken);

  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-10">
      <InviteLandingClient
        inviteToken={preview.inviteToken}
        inviterName={preview.inviter.name}
        inviterAvatar={preview.inviter.profilePicture}
        email={preview.email}
        phoneNumber={preview.phoneNumber}
        previewUrl={invitePreviewUrl(preview.inviteToken)}
      />
    </main>
  );
}
