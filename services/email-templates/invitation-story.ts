import { appUrl } from "@/lib/utils";
import { BRAND, BRAND_INITIALS } from "@/lib/branding";

export type InvitationStoryEmailData = {
  recipientEmail: string;
  inviterName: string;
  inviterAvatarUrl?: string | null;
  storyCaption?: string | null;
  previewText: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  previewUrl: string;
  signupUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mediaBlock(data: InvitationStoryEmailData) {
  const caption = data.storyCaption
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.5;color:#374151;">${escapeHtml(data.storyCaption)}</p>`
    : "";

  if (data.mediaType === "video") {
    return `
      <a href="${data.previewUrl}" style="display:block;text-decoration:none;border-radius:20px;overflow:hidden;">
        <div style="position:relative;background:#111827;border-radius:20px;overflow:hidden;">
          <img src="${data.mediaUrl}" alt="Story preview" width="100%" style="display:block;width:100%;max-height:420px;object-fit:cover;opacity:0.92;" />
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.45));">
            <div style="width:72px;height:72px;border-radius:999px;background:rgba(255,255,255,0.92);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,0.25);">
              <div style="width:0;height:0;border-top:12px solid transparent;border-bottom:12px solid transparent;border-left:18px solid #111827;margin-left:4px;"></div>
            </div>
          </div>
        </div>
      </a>
      ${caption}
    `;
  }

  return `
    <a href="${data.previewUrl}" style="display:block;text-decoration:none;border-radius:20px;overflow:hidden;">
      <img src="${data.mediaUrl}" alt="Story preview" width="100%" style="display:block;width:100%;max-height:420px;object-fit:cover;border-radius:20px;" />
    </a>
    ${caption}
  `;
}


export function buildInvitationStoryEmail(data: InvitationStoryEmailData) {
  const inviterInitial = escapeHtml(data.inviterName.slice(0, 1).toUpperCase());
  const avatar = data.inviterAvatarUrl
    ? `<img src="${data.inviterAvatarUrl}" alt="" width="48" height="48" style="border-radius:999px;object-fit:cover;display:block;" />`
    : `<div style="width:48px;height:48px;border-radius:999px;background:linear-gradient(135deg,#2563EB,#14B8A6);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;">${inviterInitial}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(data.inviterName)} shared a story with you</title>
  <style>
  @media (prefers-color-scheme: dark) {
    .email-bg { background:#0a0a0e !important; }
    .email-card { background:#16161c !important; border-color:#26262e !important; }
    .email-text { color:#f5f5fa !important; }
    .email-muted { color:#949aa8 !important; }
  }
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background:#f5f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:18px;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#2563EB,#14B8A6);color:white;font-weight:800;display:flex;align-items:center;justify-content:center;">${BRAND_INITIALS}</div>
                <span class="email-text" style="font-size:18px;font-weight:700;color:#111827;">${escapeHtml(BRAND.name)}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td class="email-card" style="background:#ffffff;border:1px solid #e8e8f0;border-radius:24px;padding:24px;box-shadow:0 20px 50px rgba(17,17,24,0.08);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding-bottom:16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-right:12px;vertical-align:middle;">${avatar}</td>
                        <td style="vertical-align:middle;">
                          <div class="email-text" style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(data.inviterName)}</div>
                          <div class="email-muted" style="font-size:13px;color:#6b7280;margin-top:2px;">introduced you on ${escapeHtml(BRAND.name)}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="email-text" style="font-size:22px;line-height:1.25;font-weight:800;color:#111827;padding-bottom:8px;">
                    You were invited to see a story
                  </td>
                </tr>
                <tr>
                  <td class="email-muted" style="font-size:15px;line-height:1.6;color:#6b7280;padding-bottom:20px;">
                    ${escapeHtml(data.previewText)}
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:20px;">
                    ${mediaBlock(data)}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <a href="${data.previewUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563EB,#14B8A6);color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:999px;box-shadow:0 10px 24px rgba(37,99,235,0.28);">
                      View story preview
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="${data.signupUrl}" class="email-muted" style="font-size:14px;color:#6b7280;text-decoration:underline;">
                      Join ${escapeHtml(BRAND.name)} to connect
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="email-muted" style="padding-top:18px;font-size:12px;line-height:1.5;color:#9ca3af;">
              This invite was sent to ${escapeHtml(data.recipientEmail)}.<br />
              Preview links expire when the story expires.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${data.inviterName} introduced you on ${BRAND.name}.`,
    "",
    data.previewText,
    data.storyCaption ? `"${data.storyCaption}"` : "",
    "",
    `Preview: ${data.previewUrl}`,
    `Sign up: ${data.signupUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `${data.inviterName} shared a story with you on ${BRAND.name}`,
    html,
    text,
  };
}

export function buildGenericInvitationEmail(args: {
  recipientEmail: string;
  inviterName: string;
  inviteUrl: string;
  previewUrl?: string;
}) {
  const previewUrl = args.previewUrl || args.inviteUrl;
  return buildInvitationStoryEmail({
    recipientEmail: args.recipientEmail,
    inviterName: args.inviterName,
    previewText: `${args.inviterName} wants you to join ${BRAND.name} and meet new friends through story introductions.`,
    mediaUrl: appUrl("/og-default.png"),
    mediaType: "image",
    previewUrl,
    signupUrl: args.inviteUrl,
  });
}
