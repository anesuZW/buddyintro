import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { exportUserData, deleteUserAccount } from "@/services/consent";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async () => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const data = await exportUserData(userAuth.id);
  return NextResponse.json(data);
});

export const DELETE = withApiHandler(async () => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.auth.admin.deleteUser(userAuth.id);
  } catch (error) {
    console.error("[account] supabase delete failed", error);
  }
  await deleteUserAccount(userAuth.id);
  return NextResponse.json({ ok: true });
});
