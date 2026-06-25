import "server-only";

import { Resend } from "resend";
import nodemailer from "nodemailer";
import { BRAND_EMAIL_FROM } from "@/lib/branding";

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function getFromAddress() {
  return BRAND_EMAIL_FROM;
}

async function sendViaResend(args: SendEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });

  if (error) throw new Error(error.message);
  return true;
}

async function sendViaSmtp(args: SendEmailArgs) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  if (!host || !port) return false;

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  await transporter.sendMail({
    from: getFromAddress(),
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
  return true;
}

/** Sends a transactional email via Resend, falling back to SMTP, then logging. Never throws. */
export async function sendEmail(args: SendEmailArgs) {
  try {
    if (await sendViaResend(args)) return { ok: true as const, provider: "resend" as const };
  } catch (error) {
    console.error("[email] Resend failed", error);
  }

  try {
    if (await sendViaSmtp(args)) return { ok: true as const, provider: "smtp" as const };
  } catch (error) {
    console.error("[email] SMTP failed", error);
  }

  console.warn(
    "[email] No email provider configured — skipping send to",
    args.to,
    `(from=${getFromAddress()})`
  );
  return { ok: false as const, provider: null };
}
