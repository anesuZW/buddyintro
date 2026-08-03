import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { acceptInvitation } from "@/services/invites";
import { safeInternalPath } from "@/lib/safe-path";
import { appLogger } from "@/lib/logger";

/**
 * OAuth / magic-link / invite / password-recovery callback.
 * Exchanges the auth code for a session, ensures a public.users row,
 * and applies any invite token in the URL.
 * Password recovery uses `next=/reset-password` from the reset email link.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let next = safeInternalPath(url.searchParams.get("next"), "/home");
  const inviteToken =
    url.searchParams.get("invite") || url.searchParams.get("invite_token") || undefined;

  const supabase = createSupabaseServerClient();

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      appLogger.error("auth callback code exchange failed", {
        route: "auth/callback",
        error: exchangeError.message,
      });
      const login = new URL("/login", request.url);
      login.searchParams.set("error", "auth");
      return NextResponse.redirect(login);
    }
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
          next = safeInternalPath(`/stories/${result.authorId}`, "/home");
        } else if (!result.ok) {
          appLogger.error("auth callback invite accept failed", {
            route: "auth/callback",
            reason: result.reason,
            userId: user.id,
          });
          // Stay signed in; surface invite failure on the destination.
          const dest = new URL(next, request.url);
          dest.searchParams.set("invite_error", result.reason);
          return NextResponse.redirect(dest);
        }
      } catch (err) {
        appLogger.error("auth callback acceptInvitation threw", {
          route: "auth/callback",
          error: err instanceof Error ? err.message : String(err),
          userId: user.id,
        });
        const dest = new URL(next, request.url);
        dest.searchParams.set("invite_error", "failed");
        return NextResponse.redirect(dest);
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
