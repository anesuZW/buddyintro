import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { recordUserConsent, getLatestConsent } from "@/services/consent";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

export async function GET() {
  const user = await requireUser();
  const consent = await getLatestConsent(user.id);
  return NextResponse.json({ consent, versions: LEGAL_VERSIONS });
}

const Schema = z.object({
  privacyVersion: z.string().optional(),
  termsVersion: z.string().optional(),
  cookieVersion: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() ?? null;
  const country = request.headers.get("x-vercel-ip-country") ?? null;

  const consent = await recordUserConsent({
    userId: user.id,
    ...parsed.data,
    ipAddress,
    country,
  });

  return NextResponse.json({ consent }, { status: 201 });
}
