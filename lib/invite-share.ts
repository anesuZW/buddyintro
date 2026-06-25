import { appUrl } from "@/lib/utils";
import { phoneDigitsE164 } from "@/lib/phone";
import { BRAND } from "@/lib/branding";

export type InviteShareMethod = "whatsapp" | "sms" | "imessage";

const INVITE_MESSAGE = `Hi! You have been introduced on ${BRAND.name}. View your introduction here:`;

export function buildInviteShareMessage(token: string) {
  const link = appUrl(`/invite/${token}`);
  return `${INVITE_MESSAGE}\n\n${link}`;
}

export function buildInviteShareLinks(args: {
  token: string;
  phoneNumber?: string | null;
}) {
  const inviteLink = appUrl(`/invite/${args.token}`);
  const previewLink = appUrl(`/invite-preview/${args.token}`);
  const message = buildInviteShareMessage(args.token);
  const encoded = encodeURIComponent(message);

  const phone = args.phoneNumber ? phoneDigitsE164(args.phoneNumber) : null;

  return {
    inviteLink,
    previewLink,
    message,
    whatsapp: phone ? `https://wa.me/${phone}?text=${encoded}` : null,
    sms: phone ? `sms:${args.phoneNumber}?body=${encoded}` : null,
    imessage: phone ? `sms:${args.phoneNumber}?body=${encoded}` : null,
  };
}
