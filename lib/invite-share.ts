import { appUrl } from "@/lib/utils";
import { phoneDigitsE164 } from "@/lib/phone";
import { BRAND } from "@/lib/branding";

export type InviteShareMethod = "whatsapp" | "sms" | "imessage";

export type InviteShareCopyArgs = {
  token: string;
  inviterName?: string | null;
  relationshipLabel?: string | null;
};

function possessiveCommunity(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "their community";
  return /s$/i.test(trimmed) ? `${trimmed}' community` : `${trimmed}'s community`;
}

function withArticle(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "a friend";
  if (/^(a|an|the)\s/i.test(trimmed)) return trimmed;
  return /^[aeiou]/i.test(trimmed) ? `an ${trimmed}` : `a ${trimmed}`;
}

/**
 * Personalized invite body designed for curiosity + clicks.
 * Link always points at /invite-preview so OG crawlers get story metadata.
 */
export function buildInviteShareMessage(args: InviteShareCopyArgs | string) {
  const token = typeof args === "string" ? args : args.token;
  const inviterName =
    typeof args === "string" ? null : args.inviterName?.trim() || null;
  const relationship =
    typeof args === "string" ? null : args.relationshipLabel?.trim() || null;

  const link = appUrl(`/invite-preview/${token}`);

  if (inviterName && relationship) {
    return (
      `${inviterName} has introduced you to ${possessiveCommunity(inviterName)} as ${withArticle(relationship)}.\n\n` +
      `See what they shared about you on ${BRAND.name}.\n\n` +
      `${link}`
    );
  }

  if (inviterName) {
    return (
      `${inviterName} thinks you should meet more amazing people.\n\n` +
      `Here's why they introduced you on ${BRAND.name}.\n\n` +
      `${link}`
    );
  }

  return (
    `You've been introduced on ${BRAND.name}.\n\n` +
    `See what they shared about you.\n\n` +
    `${link}`
  );
}

export function buildInviteShareLinks(args: {
  token: string;
  phoneNumber?: string | null;
  inviterName?: string | null;
  relationshipLabel?: string | null;
}) {
  const inviteLink = appUrl(`/invite/${args.token}`);
  const previewLink = appUrl(`/invite-preview/${args.token}`);
  const message = buildInviteShareMessage({
    token: args.token,
    inviterName: args.inviterName,
    relationshipLabel: args.relationshipLabel,
  });
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
