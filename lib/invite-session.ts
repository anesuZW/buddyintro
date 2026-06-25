export const INVITE_SESSION_COOKIE = "fi_invite_token";
export const INVITE_EMAIL_COOKIE = "fi_invite_email";

export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type InviteSessionPayload = {
  token: string;
  email: string;
  inviterName?: string;
  inviterAvatar?: string | null;
  storyMediaUrl?: string;
  storyMediaType?: "image" | "video";
  storyCaption?: string | null;
};

export function parseInviteSessionCookie(
  token?: string | null,
  email?: string | null
): Pick<InviteSessionPayload, "token" | "email"> | null {
  if (!token || !email) return null;
  return { token, email };
}
