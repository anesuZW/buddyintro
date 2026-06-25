import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { exportUserData, deleteUserAccount } from "@/services/consent";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await requireUser();
  const data = await exportUserData(user.id);
  return NextResponse.json(data);
}

export async function DELETE() {
  const user = await requireUser();
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.auth.admin.deleteUser(user.id);
  } catch (error) {
    console.error("[account] supabase delete failed", error);
  }
  await deleteUserAccount(user.id);
  return NextResponse.json({ ok: true });
}
