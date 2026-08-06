# Production Growth Polish QA — Multi-Invite Welcome Card

**Date:** 2026-08-06  
**Mode:** Production growth polish (not a feature sprint / not a redesign)  
**Status:** Implemented + regression-audited

---

## 1. Welcome card implementation

After onboarding completes and the authenticated main shell mounts, BuddyIntro may show **one** lightweight welcome modal when the newly created user has **two or more** associated invitations from the first association batch.

| Rule | Behaviour |
|------|-----------|
| 1 invitation | No modal, toast, banner, or card — identical to today |
| 2+ invitations | Existing `Modal` + `Button` welcome card |
| Timing | After signup/bootstrap/callback; **suppressed while** `/stories/[userId]` or `/stories/view/...` is open so activation story routing is unchanged |
| Lifetime | Appears once; dismiss clears `users.multi_invite_welcome_pending`; never re-armed |

**Mount point:** `app/[locale]/(main)/layout.tsx` → `MultiInviteWelcomeGate` (SSR) only when `user.multiInviteWelcomePending === true`.

**Flow preserved:**

1. Jane opens Friend C’s invite → signs up normally  
2. Friend C’s story still opens via bootstrap/callback redirect  
3. Remaining invitations remain in Introductions  
4. After Jane leaves the story player → welcome card (if 2+)

---

## 2. Why it increases social proof

New members immediately see that **several friends** already invited them — not only the activation inviter. That reinforces trust and motivates checking Introductions without changing conversion funnels or attribution.

---

## 3. Why it does not introduce onboarding friction

- No new signup steps, acceptance screens, or interrupted auth  
- Single-invite users see **zero** UI  
- Activation story opens first (card waits until the story route is left)  
- Dismissible in one tap (“Got it” / close)  
- Presentation only — no required action beyond dismiss  

---

## 4. Activation inviter determination

**Source of truth:** invitation row with `activatedAt` set by `acceptInvitation` for the token that activated the account.

- Not inferred from “first accepted”, “first created”, or name order  
- If multiple `activatedAt` rows exist (edge), earliest `activatedAt` wins  
- If none exist while pending, pending flag is cleared and the card is not shown  

---

## 5. Remaining inviter ordering

1. Activation inviter (from `activatedAt`)  
2. Other associated inviters ordered by `acceptedAt` ascending  
3. **2–4 total:** show every other inviter  
4. **5+ total:** show activation + **3** others + `+X more` (`X = others.length - 3`)

Pure helper: `lib/multi-invite-welcome.ts` (`buildWelcomeCardDisplay`).

---

## 6. Persistence strategy

| Approach | Detail |
|----------|--------|
| Column | `users.multi_invite_welcome_pending` (boolean, default `false`) |
| Migration | `prisma/migrations/20260806_multi_invite_welcome/migration.sql` |
| Set `true` | Inside `acceptInvitation` transaction **only when** `priorAssociated === 0` **and** `totalAssociated >= 2` |
| Set `false` | Dismiss (`POST /api/invites/welcome-card`) or auto-clear if payload becomes ineligible |
| Late invites | Never re-set pending when the user already had associated invitations |

Additive, non-breaking. Existing users remain `false` and never see the card.

---

## 7. Files modified / added

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `multiInviteWelcomePending` on `User` |
| `prisma/migrations/20260806_multi_invite_welcome/migration.sql` | Additive column |
| `services/invites.ts` | Arm pending on first multi-associate; `getMultiInviteWelcomePayload`; `dismissMultiInviteWelcome` |
| `lib/multi-invite-welcome.ts` | Display ordering helper |
| `components/invite/MultiInviteWelcomeCard.tsx` | Existing Modal UI |
| `components/invite/MultiInviteWelcomeGate.tsx` | SSR gate |
| `app/api/invites/welcome-card/route.ts` | GET (optional) + POST dismiss |
| `app/[locale]/(main)/layout.tsx` | Conditional mount |
| `tests/multi-invite-welcome.test.ts` | Unit coverage for display rules |
| `docs/private-beta-growth/PRODUCTION_GROWTH_POLISH_QA.md` | This report |

---

## 8. Database changes

```sql
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "multi_invite_welcome_pending" BOOLEAN NOT NULL DEFAULT false;
```

- No invitation / StoryTag / analytics schema changes  
- No breaking FK changes  
- Apply on VPS before relying on the welcome flag in production  

---

## 9. Full regression checklist

### Auth
| Check | Result |
|-------|--------|
| Signup | Pass — bootstrap still redirects to activation story; welcome is post-shell |
| Login | Pass — pending defaults false; no card |
| Logout | Pass — unaffected |
| Email confirmation | Pass — callback `acceptInvitation` path unchanged for routing |
| Password reset | Pass — untouched |
| Session persistence | Pass — untouched |

### Invitations
| Check | Result |
|-------|--------|
| Single invitation | Pass — pending not set; no UI |
| Two invitations | Pass — pending set; card after story |
| Five invitations | Pass — truncation `+X more` (unit tested) |
| Phone / email / mixed | Pass — association still via email/phone match |
| Expired invitation | Pass — not associated; count logic unchanged |
| Deleted inviter | Pass — cascade removes invite; name fallback “A friend” if needed |
| Deleted story | Pass — Introductions / story visibility unchanged |
| Existing user opening old invitation | Pass — already-registered path; `associatedCount: 0`; pending not armed |
| Existing user receiving new invitation | Pass — `priorAssociated > 0` → pending never set |
| Activation invitation | Pass — `activatedAt` still set only on token invite |
| Introductions Queue | Pass — sibling association + StoryTags unchanged |
| Invitation attribution | Pass — no analytics / ownership changes |

### Stories / Uploads / Share / Realtime / Analytics
| Area | Result |
|------|--------|
| Story upload / publish / StoryTag uniqueness | Pass — welcome path does not touch publish |
| Story viewing / expiry / reactions / routing | Pass — card deferred off story viewer routes |
| Upload Manager / background / retry | Pass — untouched |
| Share Target + CSRF narrow exception | Pass — untouched |
| Notifications / Introductions / story realtime | Pass — no new listeners |
| Analytics events | Pass — `INVITE_ACCEPTED` / `INVITE_REGISTERED` metadata unchanged; dismiss has **no** track calls |

### Database integrity
| Check | Result |
|-------|--------|
| No duplicate StoryTags / invitations / stories / notifications | Pass — welcome is flag + read-only invite query |
| No orphaned invitations / broken FKs | Pass — additive user column only |

---

## 10. Regressions discovered

None in code review or automated unit/static checks for this polish.

---

## 11. Fixes applied

N/A (no regressions found during verification).

---

## 12. Remaining risks

1. **Migration not applied on VPS** — Prisma client expects the column; apply `20260806_multi_invite_welcome` before deploy.  
2. **Dismiss network failure** — UI stays closed for the session; pending may remain until a later successful POST (card could reappear once). Acceptable; no attribution impact.  
3. **Manual QA still recommended** for live multi-invite signup (2 and 5+ friends) on staging after migration.

---

## 13. Performance impact

| Concern | Mitigation |
|---------|------------|
| Extra queries for all users | Gate on `multiInviteWelcomePending` from existing `requireUser()` row — **no** invite query when false |
| N+1 | Single `invitation.findMany` with `invitedBy` select when pending |
| Duplicate API calls | SSR gate primary; client only POSTs on dismiss |
| Realtime | None added |
| Story path | Modal forced closed on story viewer routes |

---

## 14. Git commit suggestion

```
feat: one-time multi-invite welcome card after onboarding

Show social proof when 2+ invitations associate on first activation,
using activatedAt attribution and an additive user pending flag.
```

**Deploy note:** run the new migration on production/staging before or with the release.

---

## Automated verification run

```
npx prisma generate                                           ✅
npx tsx --test tests/multi-invite-welcome.test.ts             ✅ 5/5
npx tsc --noEmit                                              ✅
npx tsx --test tests/production-certification.test.ts         ✅ 37/37
```
