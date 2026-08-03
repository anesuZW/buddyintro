# Link Preview Report

## Root causes (before)

1. **Shared URL ≠ OG page** — WhatsApp/SMS used `/invite/...` while `generateMetadata` only lived on `/invite-preview/...`.
2. **Signed media in `og:image`** — Supabase signed URLs expire (~1h); crawler caches break later.
3. **Video URLs as images** — many crawlers reject non-image `og:image`.
4. **Generic titles** — no relationship or personalization.

## Fixes

| Fix | Detail |
|-----|--------|
| Share preview URLs | `buildInviteShareMessage` links to `/invite-preview/{token}` |
| OG on both routes | `generateMetadata` on invite + invite-preview via `buildInviteOpenGraph` |
| Stable OG image | `/api/public/invites/{token}/og` redirects to signed media or brand icon |
| Personalized title | `{Name} introduced you as a {Relationship}` |
| Brand fallback | `/icons/icon-512.png` for video / missing media |

## Expected crawler behaviour

| Surface | Preview |
|---------|---------|
| WhatsApp | Title + description + image (via OG endpoint) |
| iMessage | Same Open Graph tags |
| SMS | Link only (no rich preview); copy still personalized |
| Telegram / Discord / Slack / Messenger | Consume OG from preview URL |

## Validation checklist

- [ ] Share a fresh invite to WhatsApp → preview shows inviter + relationship  
- [ ] Re-check same link after 2+ hours → image still resolves via OG route  
- [ ] Video introduction → brand icon or poster, not a broken video URL  
- [ ] Confirm `NEXT_PUBLIC_APP_URL` matches production host  
