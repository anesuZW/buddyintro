# Production Hardening + Multi-Invite Architecture

**Date:** 2026-08-06  
**Status:** Implemented in code (apply DB migrations on VPS before relying on new columns)

---

## 1. Root cause of duplicate StoryTag creation

**Verified:** `createInvitation()` reused any pending invitation for the same `(contact, inviter)`, then `createStoryWithTags()` always called `storyTag.create({ invitationId })`.

Because `StoryTag.invitationId` is `@unique`, a second story (or a retry after a successful first publish) attempted to attach the **same** invitation ID again → Prisma `P2002` on `(invitation_id)`.

This was **not** caused by React Strict Mode, realtime, or DB triggers inserting StoryTags. Triggers only UPDATE tags / publish stories.

---

## 2. Complete publish call chain

```
StoryUploader.submit()
  → uploadManager.enqueue(...)
UploadManagerProvider.processQueue()
  → transportUpload(media [, voice])
  → finalizeIntroduction()
       → POST /api/stories
app/api/stories/route.ts
  → createStoryWithTags()
       → tx.story.create()
       → for each external tag:
            createInvitation()          ← reused pending invite (bug)
            tx.storyTag.create({ invitationId })  ← P2002 on 2nd story/retry
```

Amplifiers: Upload Manager **Retry** after a successful-but-unacked POST; concurrent tabs; second introduction to the same pending phone/email.

---

## 3. Root cause of one-invite architecture

Product intent was “one pending invite per contact per inviter,” implemented as `findFirst` reuse. Combined with `StoryTag.invitationId @unique`, that enforced **one invitation → one story tag → one story**, and `acceptInvitation` only resolved the **token** invite — never siblings from other friends.

---

## 4. New multi-invite architecture

```
Invitation (many, preserved forever)
    ↓ matched by phone / email / token
Potential identity (pending contact)
    ↓ accept / signup
Actual User
    ↓
All matching invitations associated (registeredUserId)
Activation invitation alone gets activatedAt
Each invitation’s story becomes visible via StoryTag.taggedUserId
```

- Friend A/B/C/D each keep their own invitation rows.
- Opening Friend C’s link sets C as activation source (`activatedAt`).
- A/B/D are still associated and their stories appear in Introductions.

---

## 5. Matching algorithm

Deterministic priority when associating on accept:

1. Explicit invitation token (activation source)  
2. Email (normalized lowercase)  
3. Phone (E.164 via `normalizePhone`)  
4. Authenticated `userId` for already-linked rows  

Never display names.

On accept: load **all** pending, non-expired invitations matching email **or** phone (in addition to the token), and associate every one.

---

## 6. Conflict resolution

| Conflict | Resolution |
|----------|------------|
| Same inviter, same contact, 2nd story | Mint **new** invitation (reuse only if pending invite has **no** StoryTag) |
| Retry after successful finalize | Client skips re-POST if `job.storyId` set; server `ensureInvitationStoryTag` is idempotent |
| Concurrent double create | Catch `P2002`, re-read tag by `invitationId` |
| Unique constraint | **Kept** — not removed |

---

## 7. Upload Manager investigation

| Check | Finding |
|-------|---------|
| Mounted? | Yes — `PwaProviders` in locale layout |
| Hidden after phone publish? | **Yes (bug)** — `hidden: true` when Ready-to-Share opened |
| CSS / z-index | `z-[60]` above nav; bottom offset now uses `4rem + safe-area` |
| Survive navigation? | Yes (provider above routes) |
| Survive refresh? | No (in-memory) — unload warning remains |

**Fix:** stop auto-hiding completed jobs; keep dock discoverable; skip duplicate finalize when `storyId` exists.

---

## 8. Email confirmation verification

- Auth is Supabase (no NextAuth / `NEXTAUTH_URL`).
- Confirmation redirects use `appUrl('/auth/callback?...')` from `SignupClient`.
- `appUrl` / invite URL helpers now prefer `NEXT_PUBLIC_APP_URL` → `window.location.origin` → localhost (dev) → `https://${BRAND.domain}` (prod SSR last resort).
- Removed hardcoded `buddyintro.app` fallbacks in `layout` / `sitemap` / `robots` (use `BRAND.domain`).
- **Ops:** production must set `NEXT_PUBLIC_APP_URL` and matching Supabase redirect allowlist.

---

## 9. Share Target CSRF verification

- Fail-closed CSRF rejected Android Share Target when Origin/Referer were present but not allowlisted.
- **Minimal exception:** `POST /api/share/target` with `multipart/form-data` only (`isShareTargetRequest`). Other APIs unchanged.
- Route still requires auth for media upload; cookie draft is httpOnly.

---

## 10. Schema additions (additive)

```sql
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS invitations_registered_user_id_idx ON invitations (registered_user_id);
```

Migration: `prisma/migrations/20260806_multi_invite_attribution/migration.sql`

No drops, no rewrites of historical rows.

---

## 11. Files modified

- `services/invites.ts` — untagged-only reuse; multi-invite associate; open/activate timestamps  
- `services/stories.ts` — `ensureInvitationStoryTag` idempotent attach  
- `components/uploads/UploadManagerProvider.tsx` — no auto-hide; finalize idempotency  
- `components/uploads/UploadDock.tsx` — visibility / safe-area offset  
- `lib/security.ts` — share-target CSRF exception  
- `lib/utils.ts`, `lib/invite-preview.ts`, `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts` — env-derived URLs  
- `prisma/schema.prisma` + migration  

---

## 12. Migration requirements (VPS)

1. Apply `20260806_multi_invite_attribution`  
2. Confirm earlier `20260803_phone_aware_story_publish` is applied  
3. Set `NEXT_PUBLIC_APP_URL` + `ALLOWED_ORIGINS`  
4. Reload app  

---

## 13. Regression risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Sibling associate attaches invites user didn’t open | Medium | Required for multi-friend UX; only pending + email/phone match |
| Phone invite accept without phone verify | Existing | Unchanged for token path |
| CSRF share-target exemption abuse | Low | Multipart + path scoped; upload still auth-gated |
| Missing migration → Prisma client/runtime mismatch | High until applied | Deploy gate |

---

## 14. Why every change is backwards compatible

- Unique `invitation_id` retained.  
- Existing invitation rows untouched; new columns nullable.  
- Single-invite flows still work (associate finds zero siblings).  
- CSRF fail-closed remains for all other mutating routes.  
- Upload Manager UX restored without redesign.

---

## 15. Suggested Git commit message

```
fix(invites): idempotent StoryTag publish and multi-invite association

Reuse only untagged pending invitations, associate all matching invites on
accept, restore upload dock visibility, and exempt Web Share Target CSRF.
```
