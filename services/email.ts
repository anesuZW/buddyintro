import "server-only";

import { Resend } from "resend";
import nodemailer from "nodemailer";
import { BRAND_EMAIL_FROM } from "@/lib/branding";
import { appLogger } from "@/lib/logger";

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Logical email type for structured logs (e.g. invitation, notification). */
  type?: string;
};

/** Structured provider failure — logged and returned in emailDelivery[]. */
export type EmailProviderError = {
  provider: "resend" | "smtp" | null;
  message: string;
  statusCode?: number;
  name?: string;
  code?: string;
  response?: string;
};

export type EmailSendResult =
  | { ok: true; provider: "resend" | "smtp"; messageId?: string }
  | {
      ok: false;
      provider: "resend" | "smtp" | null;
      error: string;
      statusCode?: number;
      providerError: EmailProviderError;
    };

function getFromAddress() {
  return BRAND_EMAIL_FROM;
}

function logEmailAttempt(
  level: "info" | "warn" | "error",
  message: string,
  fields: Record<string, unknown>
) {
  appLogger[level](message, { route: "email", ...fields });
}

function extractResendError(error: {
  message?: string;
  name?: string;
  statusCode?: number | null;
}) {
  return {
    provider: "resend" as const,
    message: error.message || "Resend API error",
    statusCode: error.statusCode ?? undefined,
    name: error.name,
  };
}

type SmtpTransportError = {
  name?: string;
  code?: string;
  response?: string;
  responseCode?: number;
  command?: string;
};

function extractSmtpError(error: unknown): EmailProviderError {
  const smtp = error as SmtpTransportError;
  const response =
    typeof smtp.response === "string"
      ? smtp.response.slice(0, 500)
      : smtp.command
        ? `command=${smtp.command}`
        : undefined;
  return {
    provider: "smtp",
    message: error instanceof Error ? error.message : String(error),
    statusCode: smtp.responseCode,
    name: smtp.name,
    code: smtp.code,
    response,
  };
}

function failureResult(providerError: EmailProviderError): EmailSendResult {
  return {
    ok: false,
    provider: providerError.provider,
    error: providerError.message,
    statusCode: providerError.statusCode,
    providerError,
  };
}

async function sendViaResend(args: SendEmailArgs): Promise<{ messageId?: string } | false> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });

  if (error) {
    const providerError = extractResendError(error);
    logEmailAttempt("error", "Resend API rejected send", {
      recipient: args.to,
      type: args.type ?? "transactional",
      provider: "resend",
      providerError,
    });
    throw providerError;
  }

  return { messageId: data?.id };
}

async function sendViaSmtp(args: SendEmailArgs): Promise<{ messageId?: string } | false> {
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

  const info = await transporter.sendMail({
    from: getFromAddress(),
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });

  return { messageId: info.messageId };
}

/**
 * Send a transactional email via Resend with SMTP fallback.
 * Returns structured result — never throws (callers must check `ok`).
 */
export async function sendEmail(args: SendEmailArgs): Promise<EmailSendResult> {
  const baseFields = {
    recipient: args.to,
    subject: args.subject,
    type: args.type ?? "transactional",
    from: getFromAddress(),
  };

  try {
    const resendResult = await sendViaResend(args);
    if (resendResult) {
      logEmailAttempt("info", "email sent via Resend", {
        ...baseFields,
        provider: "resend",
        messageId: resendResult.messageId,
        providerResponse: { status: "accepted", messageId: resendResult.messageId },
      });
      return { ok: true, provider: "resend", messageId: resendResult.messageId };
    }
  } catch (error) {
    const resendError =
      error && typeof error === "object" && "provider" in error
        ? (error as EmailProviderError)
        : extractResendError(error as { message?: string; name?: string; statusCode?: number });

    logEmailAttempt("error", "Resend send failed — trying SMTP fallback", {
      ...baseFields,
      providerError: resendError,
    });

    try {
      const smtpResult = await sendViaSmtp(args);
      if (smtpResult) {
        logEmailAttempt("info", "email sent via SMTP fallback", {
          ...baseFields,
          provider: "smtp",
          messageId: smtpResult.messageId,
          providerResponse: { status: "accepted", messageId: smtpResult.messageId },
          resendProviderError: resendError,
        });
        return { ok: true, provider: "smtp", messageId: smtpResult.messageId };
      }
    } catch (smtpError) {
      const smtpProviderError = extractSmtpError(smtpError);
      logEmailAttempt("error", "SMTP fallback failed", {
        ...baseFields,
        providerError: smtpProviderError,
        resendProviderError: resendError,
      });
      return failureResult(smtpProviderError);
    }

    return failureResult(resendError);
  }

  try {
    const smtpResult = await sendViaSmtp(args);
    if (smtpResult) {
      logEmailAttempt("info", "email sent via SMTP", {
        ...baseFields,
        provider: "smtp",
        messageId: smtpResult.messageId,
        providerResponse: { status: "accepted", messageId: smtpResult.messageId },
      });
      return { ok: true, provider: "smtp", messageId: smtpResult.messageId };
    }
  } catch (error) {
    const smtpProviderError = extractSmtpError(error);
    logEmailAttempt("error", "SMTP send failed", {
      ...baseFields,
      providerError: smtpProviderError,
    });
    return failureResult(smtpProviderError);
  }

  const providerError: EmailProviderError = {
    provider: null,
    message: "No email provider configured (set RESEND_API_KEY or SMTP_HOST/SMTP_PORT)",
  };
  logEmailAttempt("warn", "no email provider configured", { ...baseFields, providerError });
  return failureResult(providerError);
}

/** Send email and throw if delivery failed — use for user-visible invitation flows. */
export async function sendEmailOrThrow(args: SendEmailArgs): Promise<EmailSendResult & { ok: true }> {
  const result = await sendEmail(args);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result;
}
