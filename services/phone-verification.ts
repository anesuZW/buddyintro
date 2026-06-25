import "server-only";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { BRAND } from "@/lib/branding";
import { notifyVerification } from "@/services/notifications/emitters";
import { syncUserVerificationLevel } from "@/lib/verification-gates";
import { recordVerificationCompleted } from "@/services/verification";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode() {
  return String(crypto.randomInt(100000, 999999));
}

async function sendCodeSms(phone: string, code: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return { sent: false as const };

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({ To: phone, From: from, Body: `Your ${BRAND.name} code is ${code}` });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return { sent: res.ok };
}

export async function requestPhoneVerification(userId: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error("Invalid phone number. Use international format e.g. +263774123456");

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.phoneVerificationChallenge.deleteMany({ where: { userId } });
  await prisma.phoneVerificationChallenge.create({
    data: {
      userId,
      phone,
      codeHash: hashCode(code),
      expiresAt,
    },
  });

  const sms = await sendCodeSms(phone, code);
  const betaCode = process.env.PHONE_VERIFICATION_BETA_CODE;

  return {
    phone,
    expiresAt,
    delivery: sms.sent ? ("sms" as const) : betaCode ? ("beta" as const) : ("none" as const),
    // Only expose code in beta/dev when SMS is not configured
    devHint:
      !sms.sent && betaCode && process.env.NODE_ENV !== "production"
        ? `Beta code: ${betaCode || code}`
        : undefined,
  };
}

export async function confirmPhoneVerification(userId: string, rawPhone: string, code: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error("Invalid phone number");

  const challenge = await prisma.phoneVerificationChallenge.findFirst({
    where: { userId, phone },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge || challenge.expiresAt < new Date()) {
    throw new Error("Verification code expired. Request a new one.");
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw new Error("Too many attempts. Request a new code.");
  }

  const betaCode = process.env.PHONE_VERIFICATION_BETA_CODE;
  const valid =
    hashCode(code) === challenge.codeHash || (betaCode && code === betaCode);

  if (!valid) {
    await prisma.phoneVerificationChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new Error("Invalid verification code");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerified: true },
    }),
    prisma.phoneVerificationChallenge.deleteMany({ where: { userId } }),
  ]);

  void analyticsService.track({
    userId,
    eventType: ANALYTICS_EVENTS.PHONE_VERIFIED,
    entityType: "user",
    entityId: userId,
  });

  await syncUserVerificationLevel(userId);
  void recordVerificationCompleted(userId, { level: "phone" });
  void notifyVerification({ userId, kind: "phone" }).catch((err) =>
    console.error("[verification] notify failed", err)
  );

  return { ok: true as const, phoneVerified: true };
}
