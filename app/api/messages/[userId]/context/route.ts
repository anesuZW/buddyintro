import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getChatContextPayload } from "@/services/chat-context";
import { Phase2Profiler, runWithPhase2Profile } from "@/lib/profile/phase2-profiler";

export async function GET(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  return runWithPhase2Profile("/api/messages/[userId]/context", async () => {
    const p = new Phase2Profiler("/api/messages/[userId]/context");

    const me = await p.timeRouteAuth(() => requireUser());

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
