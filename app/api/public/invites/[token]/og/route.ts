import { NextResponse } from "next/server";
import { getInvitePreviewByToken } from "@/lib/invite-preview";
import { brandOgFallbackUrl, safeOgImageRedirectUrl } from "@/lib/og-redirect";

export const dynamic = "force-dynamic";

/**
 * Stable OG image endpoint for invitation crawlers.
 * Only redirects to allowlisted media hosts / app paths — never arbitrary URLs.
 */
export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const fallback = brandOgFallbackUrl();
  const preview = await getInvitePreviewByToken(params.token);
  if (preview.status !== "ok") {
    return NextResponse.redirect(fallback, 302);
  }

  const { story } = preview;

  // Video stories: brand mark (crawlers need a static image).
  if (story.mediaType === "video") {
    return NextResponse.redirect(fallback, 302);
  }

  const safe = safeOgImageRedirectUrl(story.mediaUrl);
  if (!safe) {
    return NextResponse.redirect(fallback, 302);
  }

  const res = NextResponse.redirect(safe, 302);
  res.headers.set("Cache-Control", "public, max-age=300");
  return res;
}
