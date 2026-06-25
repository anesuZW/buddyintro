import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  confirmPhoneVerification,
  requestPhoneVerification,
} from "@/services/phone-verification";

const RequestSchema = z.object({
  phone: z.string().min(8),
});

const VerifySchema = z.object({
  phone: z.string().min(8),
  code: z.string().min(4).max(8),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const body = RequestSchema.parse(await request.json());
  try {
    const result = await requestPhoneVerification(user.id, body.phone);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not send code";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireUser();
  const body = VerifySchema.parse(await request.json());
  try {
    const result = await confirmPhoneVerification(user.id, body.phone, body.code);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    identityVerified: user.identityVerified,
  });
}
