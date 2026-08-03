# Regression Report — Private Beta Growth Sprint

**Date:** 2026-08-02  
**Typecheck:** `npm run typecheck` → pass

## Surfaces touched

| Area | Risk | Mitigation |
|------|------|------------|
| Introduction create | High | Upload Manager mirrors prior `/api/stories` payload; phone tags unchanged |
| Invite share copy | Medium | Backward-compatible `buildInviteShareMessage(token)` overload |
| Invite accept | High | Tags + publish only for invitation-linked drafts |
| Story player | Medium | Silent images keep 6s timer; media clock only when video/voice present |
| Share target | Medium | Falls back to text hint if unauthenticated / upload fails |
| Notifications | Low | CSS/layout only |
| Upload limit 25→100 MB | Ops | Requires nginx `101m` on VPS |

## Manual matrix

| Flow | Status |
|------|--------|
| Create intro with phone → background upload → Ready-to-Share → WhatsApp | Code complete — verify on device |
| Oversize file rejected before upload | Client validation unit path ready |
| Discoveries / messages / home navigation during upload | Dock survives via `PwaProviders` |
| Open invite-preview OG | Metadata + `/og` route |
| Accept invite → see introduction | `acceptInvitation` tags + publish |
| Story with voice note full playback | StoryPlayer media clock |
| Notification bell / page layout | Polish applied |
| Share to BuddyIntro (authed) | Uploads media when signed in |
| Auth / trust / recommendations / onboarding | **Not modified** |

## Performance notes

- Upload Manager is a thin in-memory queue (one active XHR); no polling loops.
- StoryPlayer uses `requestAnimationFrame` only while media-driven segments are active.
- OG route is a 302 redirect — no image processing on the Node process.
- Perceived speed: publish returns immediately; upload continues off the create screen.

## Known follow-ups

1. Apply nginx `101m` on production before advertising 100 MB.  
2. Optional: StoryUploader remote-URL prefill from `fi-shared-media` session key.  
3. Optional: durable OG JPEG renderer (canvas) instead of redirect to signed media.  
