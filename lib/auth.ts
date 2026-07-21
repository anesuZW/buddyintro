import { redirect } from "next/navigation";

import { cache } from "react";

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { prisma } from "@/lib/prisma";

import { isAdminEmail } from "@/lib/utils";

import { hasPermission, syncLegacyAdminRole } from "@/services/rbac";

import { PERMISSIONS } from "@/lib/permissions";

import {
  isAuthProfileEnabled,
  logAuthProfile,
  readAuthProfileRequestId,
  recordGetCurrentUserCall,
  recordPrismaUserLookup,
  recordSupabaseGetUser,
} from "@/lib/auth-profile";

import { getAuthUserFromTrustedHeaders } from "@/lib/auth-trusted-headers";

import type { User as DbUser } from "@prisma/client";



/** Returns the authenticated Supabase auth user or null. */

export async function getAuthUser() {

  const profile = isAuthProfileEnabled();

  const requestId = profile ? readAuthProfileRequestId() : null;

  const totalStart = profile ? performance.now() : 0;

  const headerUser = getAuthUserFromTrustedHeaders();

  if (headerUser) {

    if (profile) {

      logAuthProfile(requestId, "getAuthUser", {

        supabaseGetUser: 0,

        source: "middleware-headers",

        total: Math.round(performance.now() - totalStart),

      });

    }

    return headerUser;

  }

  const supabase = createSupabaseServerClient();

  const supabaseStart = profile ? performance.now() : 0;

  const {

    data: { user },

  } = await supabase.auth.getUser();

  if (profile) {

    const supabaseMs = Math.round(performance.now() - supabaseStart);

    recordSupabaseGetUser(supabaseMs);

    logAuthProfile(requestId, "getAuthUser", {

      supabaseGetUser: supabaseMs,

      source: "supabase-fallback",

      total: Math.round(performance.now() - totalStart),

    });

  }

  return user;

}



/** Loads (or upserts) the public.users row for the current session. */

export const getCurrentUser = cache(async (): Promise<DbUser | null> => {

  const profile = isAuthProfileEnabled();

  const requestId = profile ? readAuthProfileRequestId() : null;

  const totalStart = profile ? performance.now() : 0;

  if (profile) recordGetCurrentUserCall();

  const getAuthStart = profile ? performance.now() : 0;

  const authUser = await getAuthUser();

  const getAuthMs = profile ? Math.round(performance.now() - getAuthStart) : 0;

  if (!authUser) return null;



  const prismaStart = profile ? performance.now() : 0;

  let user = await prisma.user.findUnique({ where: { id: authUser.id } });

  if (!user) {

    user = await prisma.user.create({

      data: {

        id: authUser.id,

        email: authUser.email!,

        name:

          (authUser.user_metadata?.name as string | undefined) ||

          authUser.email!.split("@")[0],

        profilePicture:

          (authUser.user_metadata?.avatar_url as string | undefined) || null,

        emailVerified: Boolean(authUser.email_confirmed_at),

      },

    });

  } else if (authUser.email_confirmed_at && !user.emailVerified) {

    user = await prisma.user.update({

      where: { id: user.id },

      data: { emailVerified: true },

    });

    const { syncUserVerificationLevel } = await import("@/lib/verification-gates");

    void syncUserVerificationLevel(user.id);

  }



  if (user && !user.bannedAt) {

    await syncLegacyAdminRole(user);

  }



  if (profile) {

    const prismaMs = Math.round(performance.now() - prismaStart);

    recordPrismaUserLookup(prismaMs);

    logAuthProfile(requestId, "getCurrentUser", {

      getAuthUser: getAuthMs,

      prismaUserLookup: prismaMs,

      total: Math.round(performance.now() - totalStart),

    });

  }



  return user;

});



/** Throws (redirects to /login) if not authed. Returns the DB user. */

export async function requireUser(): Promise<DbUser> {

  const profile = isAuthProfileEnabled();

  const requestId = profile ? readAuthProfileRequestId() : null;

  const totalStart = profile ? performance.now() : 0;

  const user = await getCurrentUser();

  if (profile) {

    logAuthProfile(requestId, "requireUser", {

      total: Math.round(performance.now() - totalStart),

    });

  }

  if (!user) redirect("/login");

  if (user.suspendedAt || user.bannedAt) redirect("/login?suspended=1");

  return user;

}



export type ApiAuthResult = DbUser | NextResponse;

export function isApiAuthError(result: ApiAuthResult): result is NextResponse {
  return result instanceof NextResponse;
}

/** Returns 401/403 JSON for API route handlers instead of redirecting. */
export async function requireUserApi(): Promise<ApiAuthResult> {
  const profile = isAuthProfileEnabled();
  const requestId = profile ? readAuthProfileRequestId() : null;
  const totalStart = profile ? performance.now() : 0;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.suspendedAt || user.bannedAt) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  if (profile) {
    logAuthProfile(requestId, "requireUserApi", {
      total: Math.round(performance.now() - totalStart),
    });
  }
  return user;
}

async function userIsAdmin(user: DbUser): Promise<boolean> {

  if (isAdminEmail(user.email)) return true;

  return hasPermission(user.id, PERMISSIONS.SETTINGS_MANAGE);

}



/** Throws if not an admin (RBAC or legacy ADMIN_EMAILS). */

export async function requireAdmin(): Promise<DbUser> {

  const profile = isAuthProfileEnabled();

  const requestId = profile ? readAuthProfileRequestId() : null;

  const totalStart = profile ? performance.now() : 0;

  const user = await requireUser();

  if (!(await userIsAdmin(user))) {

    redirect("/home");

  }

  if (profile) {

    logAuthProfile(requestId, "requireAdmin", {

      total: Math.round(performance.now() - totalStart),

    });

  }

  return user;

}



/** Returns 401/403 JSON for API route handlers instead of redirecting. */

export async function requireAdminApi(): Promise<ApiAuthResult> {

  const profile = isAuthProfileEnabled();

  const requestId = profile ? readAuthProfileRequestId() : null;

  const totalStart = profile ? performance.now() : 0;

  const user = await getCurrentUser();

  if (!user) {

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  }

  if (user.suspendedAt || user.bannedAt) {

    return NextResponse.json({ error: "Account suspended" }, { status: 403 });

  }

  await syncLegacyAdminRole(user);

  if (!(await userIsAdmin(user))) {

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  }

  if (profile) {

    logAuthProfile(requestId, "requireAdminApi", {

      total: Math.round(performance.now() - totalStart),

    });

  }

  return user;

}



export { isAdminEmail };


