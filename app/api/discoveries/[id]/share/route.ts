import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { recordDiscoveriesShare } from "@/services/discoveries";
import { apiJson, withApiHandler } from "@/lib/api-error";

export const POST = withApiHandler(async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  try {
    await recordDiscoveriesShare(params.id, userAuth.id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Forbidden") {
      return apiJson(403, { error: "Forbidden", code: "permission_denied" });
    }
    throw err;
  }
});
