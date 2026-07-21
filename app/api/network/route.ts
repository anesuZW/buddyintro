import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIntroductionEvidence, getConnectionReason } from "@/lib/introduction-graph";
import { serializeConnectionReason, serializeEvidence } from "@/lib/connection-reason";
import { viewerMayQueryNetworkPair } from "@/lib/access-control";

const QuerySchema = z.object({
  users: z.string().min(1),
});

export async function GET(request: Request) {
  const meAuth = await requireUserApi();
  if (meAuth instanceof NextResponse) return meAuth;
  const me = meAuth;
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({ users: searchParams.get("users") ?? "" });

  if (!parsed.success) {
    return NextResponse.json({ error: "users query required" }, { status: 400 });
  }

  const ids = parsed.data.users.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length < 2) {
    return NextResponse.json({ error: "Provide two user IDs" }, { status: 400 });
  }

  const userA = ids.includes(me.id) ? me.id : ids[0];
  const userB = ids.find((id) => id !== userA) ?? ids[1];

  if (!viewerMayQueryNetworkPair(me.id, userA, userB)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [evidence, connectionReason, users] = await Promise.all([
    getIntroductionEvidence(userA, userB),
    getConnectionReason(userA, userB),
    prisma.user.findMany({
      where: { id: { in: [userA, userB] } },
      select: { id: true, name: true, profilePicture: true },
    }),
  ]);

  return NextResponse.json({
    userAId: userA,
    userBId: userB,
    users,
    connectionReason: serializeConnectionReason(connectionReason, userA, userB),
    evidence: evidence.map(serializeEvidence),
  });
}
