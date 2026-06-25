import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { acceptInvitation } from "@/services/invites";
import { recordUserConsent } from "@/services/consent";

export async function POST(request: Request) {
  const { name, inviteToken, acceptedTerms } = (await request.json()) as {
    name?: string;
    inviteToken?: string;
    acceptedTerms?: boolean;
  };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const existing = await prisma.user.findUnique({ where: { id: user.id } });
  if (!existing) {
    try {
      await prisma.user.create({
        data: {
          id: user.id,
          email: user.email!,
          name: name || user.email!.split("@")[0],
          profilePicture:
            (user.user_metadata?.avatar_url as string | undefined) || null,
        },
      });
    } catch (error) {
      if (!isPrismaUniqueViolation(error)) throw error;
    }
  }

  if (acceptedTerms) {
    const forwarded = request.headers.get("x-forwarded-for");
    await recordUserConsent({
      userId: user.id,
      ipAddress: forwarded?.split(",")[0]?.trim() ?? null,
      country: request.headers.get("x-vercel-ip-country") ?? null,
    });
  }

  let redirectTo = "/home";

  if (inviteToken) {
    const result = await acceptInvitation({
      token: inviteToken,
      userId: user.id,
      userEmail: user.email!,
    });

    if (!result.ok) {
      const message =
        result.reason === "email_mismatch"
          ? "This invite belongs to a different email address."
          : result.reason === "expired"
            ? "This invite has expired."
            : "Invite not found.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (result.storyId && result.authorId) {
      redirectTo = `/stories/${result.authorId}`;
    }
  }

  return NextResponse.json({ ok: true, redirectTo });
}
