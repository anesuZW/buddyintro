import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { getChatContextPayload } from "@/services/chat-context";
import { Phase2Profiler, runWithPhase2Profile } from "@/lib/profile/phase2-profiler";
import { apiJson, withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async (
  _request: Request,
  { params }: { params: { userId: string } }
) => {
  const authResult = await requireUserApi();
  if (isApiAuthError(authResult)) return authResult;
  const me = authResult;

  return runWithPhase2Profile("/api/messages/[userId]/context", async () => {
    const p = new Phase2Profiler("/api/messages/[userId]/context");

    const context = await p.time("chatContext", () =>
      getChatContextPayload(me.id, params.userId)
    );
    if (!context) {
      p.log({ response: 0 });
      return apiJson(403, { error: "Forbidden", code: "permission_denied" });
    }

    await p.time("serialize", async () => JSON.stringify(context));

    const responseStart = performance.now();
    const res = NextResponse.json(context);
    const responseMs = Math.round(performance.now() - responseStart);

    p.log({ response: responseMs });
    return p.finishResponse(res, { response: responseMs });
  });
});
