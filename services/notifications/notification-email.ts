import { sendEmail } from "@/services/email";
import { BRAND, BRAND_URL } from "@/lib/branding";
import { resolveAppLocale, translateMessage } from "@/lib/i18n/messages";
import type { AppLocale } from "@/i18n/routing";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || BRAND_URL;

export async function buildNotificationEmail(args: {
  name: string;
  title: string;
  message: string;
  href: string;
  locale?: AppLocale;
}) {
  const locale = resolveAppLocale(args.locale);
  const greeting = await translateMessage(locale, "email.greeting", { name: args.name });
  const cta = await translateMessage(locale, "email.viewOnApp");
  const subject = await translateMessage(locale, "email.notificationSubject", { title: args.title });
  const url = args.href.startsWith("http") ? args.href : `${APP_URL}${args.href}`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px" dir="${locale === "ar" ? "rtl" : "ltr"}">
      <h2 style="color:#2563EB;margin:0 0 12px">${args.title}</h2>
      <p style="color:#334155;line-height:1.6">${greeting}</p>
      <p style="color:#334155;line-height:1.6">${args.message}</p>
      <p style="margin-top:24px">
        <a href="${url}" style="background:#2563EB;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
          ${cta}
        </a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:32px">
        You received this because notification emails are enabled on your account.
      </p>
    </div>`;
  const text = `${args.title}\n\n${greeting}\n\n${args.message}\n\n${url}`;
  return { html, text, subject };
}

export async function sendNotificationEmail(args: {
  to: string;
  name: string;
  title: string;
  message: string;
  href: string;
  locale?: AppLocale;
}) {
  const { html, text, subject } = await buildNotificationEmail(args);
  return sendEmail({ to: args.to, subject, html, text });
}
