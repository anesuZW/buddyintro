import { sendEmail } from "@/services/email";
import { BRAND, BRAND_URL } from "@/lib/branding";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || BRAND_URL;

export function buildNotificationEmail(args: {
  name: string;
  title: string;
  message: string;
  href: string;
}) {
  const url = args.href.startsWith("http") ? args.href : `${APP_URL}${args.href}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#2563EB;margin:0 0 12px">${args.title}</h2>
      <p style="color:#334155;line-height:1.6">Hi ${args.name},</p>
      <p style="color:#334155;line-height:1.6">${args.message}</p>
      <p style="margin-top:24px">
        <a href="${url}" style="background:#2563EB;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
          View on ${BRAND.name}
        </a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:32px">
        You received this because notification emails are enabled on your account.
      </p>
    </div>`;
  const text = `${args.title}\n\nHi ${args.name},\n\n${args.message}\n\n${url}`;
  return { html, text, subject: args.title };
}

export async function sendNotificationEmail(args: {
  to: string;
  name: string;
  title: string;
  message: string;
  href: string;
}) {
  const { html, text, subject } = buildNotificationEmail(args);
  return sendEmail({ to: args.to, subject, html, text });
}
