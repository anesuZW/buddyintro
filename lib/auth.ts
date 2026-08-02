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

import { authUploadRejectResponse } from "@/lib/upload-reject";
import { serviceUnavailableResponse } from "@/lib/api-error";
import { isPrismaConnectivityError } from "@/lib/prisma-errors";

import type { User as DbUser } from "@prisma/client";



/** Returns the authenticated Supabase auth user or null (request-scoped dedupe). */

export const getAuthUser = cache(async () => {

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
});

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

  try {
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
  } catch (err) {
    // Surface DB outages to the layout (friendly unavailable UI) instead of a blank digest page.
    console.error("[auth] getCurrentUser prisma failed", err);
    throw err;
  }
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

/** Returns 401/403/503 JSON for API route handlers instead of redirecting. */
export async function requireUserApi(): Promise<ApiAuthResult> {
  const profile = isAuthProfileEnabled();
  const requestId = profile ? readAuthProfileRequestId() : null;
  const totalStart = profile ? performance.now() : 0;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return authUploadRejectResponse(401, "User not authenticated", "Unauthorized");
    }
    if (user.suspendedAt || user.bannedAt) {
      return authUploadRejectResponse(403, "Account suspended", "Account suspended");
    }

    if (profile) {
      logAuthProfile(requestId, "requireUserApi", {
        total: Math.round(performance.now() - totalStart),
      });
    }
    return user;
  } catch (err) {
    console.error("[auth] requireUserApi failed", err);
    if (isPrismaConnectivityError(err)) {
      return serviceUnavailableResponse(
        "Database temporarily unavailable. Please retry shortly."
      );
    }
    return serviceUnavailableResponse();
  }
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



/** Returns 401/403/503 JSON for API route handlers instead of redirecting. */

export async function requireAdminApi(): Promise<ApiAuthResult> {

  const profile = isAuthProfileEnabled();

  const requestId = profile ? readAuthProfileRequestId() : null;

  const totalStart = profile ? performance.now() : 0;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return authUploadRejectResponse(401, "User not authenticated", "Unauthorized");
    }

    if (user.suspendedAt || user.bannedAt) {
      return authUploadRejectResponse(403, "Account suspended", "Account suspended");
    }

    await syncLegacyAdminRole(user);

    if (!(await userIsAdmin(user))) {
      return authUploadRejectResponse(403, "Admin access required", "Forbidden");
    }

    if (profile) {
      logAuthProfile(requestId, "requireAdminApi", {
        total: Math.round(performance.now() - totalStart),
      });
    }

    return user;
  } catch (err) {
    console.error("[auth] requireAdminApi failed", err);
    return serviceUnavailableResponse(
      isPrismaConnectivityError(err)
        ? "Database temporarily unavailable. Please retry shortly."
        : undefined
    );
  }

}



export { isAdminEmail };


