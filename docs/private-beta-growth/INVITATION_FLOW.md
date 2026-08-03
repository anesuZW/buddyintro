# Invitation Flow

## Creation

- Story with external email/phone → invitation + `StoryTag` → story stays `draft` until invitees resolve.
- Phone invites: `inviteMethod` seeded as `sms` (refined when share channel is tapped).
- Share links built with inviter name + relationship category.

## Open / preview

| Path | Role |
|------|------|
| `/invite/{token}` | Landing + cookies + OG metadata |
| `/invite-preview/{token}` | Full media preview + OG metadata |
| `/api/public/invites/{token}/og` | Stable OG image redirect (avoids embedding short-lived signed URLs in meta) |

Preview resolver (`lib/invite-preview.ts`):

- Prefers latest draft story tag (`orderBy createdAt desc`)
- Includes relationship category for copy + OG title
- Sets invite session cookies for onboarding prefill

## Accept

`acceptInvitation` now:

1. Marks invitation registered  
2. Sets `StoryTag.taggedUserId` for linked tags  
3. Publishes the story when no unresolved external tags remain  

This fixes the failure mode where invitees signed up but never saw the introduction.

## One phone entry rule

Phone is captured once in the composer tags. Ready-to-Share and `buildInviteShareLinks` reuse `invitations.phone_number` / response `phoneInvites` — never re-prompt.
