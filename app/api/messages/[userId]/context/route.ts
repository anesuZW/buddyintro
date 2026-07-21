import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { getChatContextPayload } from "@/services/chat-context";
import { Phase2Profiler, runWithPhase2Profile } from "@/lib/profile/phase2-profiler";

export async function GET(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  const authResult = await requireUserApi();
  if (authResult instanceof NextResponse) return authResult;
  const me = authResult;

  return runWithPhase2Profile("/api/messages/[userId]/context", async () => {
    const p = new Phase2Profiler("/api/messages/[userId]/context");

    const context = await p.time("chatContext", () =>
      getChatContextPayload(me.id, params.userId)
    );
    if (!context) {
      p.log({ response: 0 });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await p.time("serialize", async () => JSON.stringify(context));

    const responseStart = performance.now();
    const res = NextResponse.json(context);
    const responseMs = Math.round(performance.now() - responseStart);

    p.log({ response: responseMs });
    return p.finishResponse(res, { response: responseMs });
  });
}
