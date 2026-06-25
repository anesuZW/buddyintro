import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { acceptInvitation } from "@/services/invites";

/**
 * OAuth / magic-link / invite callback.
 * Exchanges the auth code for a session, ensures a public.users row,
 * and applies any invite token in the URL.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let next = url.searchParams.get("next") || "/home";
  const inviteToken =
    url.searchParams.get("invite") || url.searchParams.get("invite_token") || undefined;

  const supabase = createSupabaseServerClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const existing = await prisma.user.findUnique({ where: { id: user.id } });
    if (!existing) {
      await prisma.user.create({
        data: {
          id: user.id,
          email: user.email!,
          name:
            (user.user_metadata?.name as string | undefined) ||
            user.email!.split("@")[0],
          profilePicture:
            (user.user_metadata?.avatar_url as string | undefined) || null,
        },
      });
    }

    const tokenFromMeta =
      (user.user_metadata?.invite_token as string | undefined) || undefined;
    const token = inviteToken || tokenFromMeta;
    if (token) {
      try {
        const result = await acceptInvitation({
          token,
          userId: user.id,
          userEmail: user.email!,
        });
        if (result.ok && result.storyId && result.authorId) {
          next = `/stories/${result.authorId}`;
        }
      } catch (err) {
        console.error("[auth/callback] acceptInvitation failed", err);
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
