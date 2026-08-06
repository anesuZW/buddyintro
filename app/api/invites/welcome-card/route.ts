import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import {
  dismissMultiInviteWelcome,
  getMultiInviteWelcomePayload,
} from "@/services/invites";
import { withApiHandler } from "@/lib/api-error";

/** Optional client fetch — primary path is SSR gate in main layout. */
export const GET = withApiHandler(async () => {
  const meAuth = await requireUserApi();
  if (isApiAuthError(meAuth)) return meAuth;

  const payload = await getMultiInviteWelcomePayload(meAuth.id);
  return NextResponse.json({ show: Boolean(payload), payload });
});

/** Dismiss forever (presentation only — no analytics side effects). */
export const POST = withApiHandler(async () => {
  const meAuth = await requireUserApi();
  if (isApiAuthError(meAuth)) return meAuth;

  await dismissMultiInviteWelcome(meAuth.id);
  return NextResponse.json({ ok: true });
});
