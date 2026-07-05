# FriendIntro Beta Launch Readiness Report

**Date:** 2026-05-24  
**Build:** passing  
**Database verification:** 120/120 checks  
**Migrations:** through `202608_moderation_verification_realtime`

---

## Executive summary

FriendIntro is **beta-ready for a closed trust-first pilot** with real users, provided you configure SMS (Twilio), VAPID push keys, and Resend email before launch. Core notification delivery, analytics persistence, phone verification gates, user blocking/reporting, and Supabase Realtime for notification badges are implemented in this pass.

**Not yet production-grade at scale:** email digests, identity verification workflow, rate limiting, full RLS on all tables, automated moderation, and several secondary notification/analytics event types remain deferred.

---

## 1. Notification emitter audit (end-to-end)

| Emitter | Wired | Persists to `notifications` | Email/Push |
|---------|-------|------------------------------|------------|
| `notifyIntroductionReceived` | ✓ `services/stories.ts` | ✓ | ✓ |
| `notifyMessageReceived` / story reply / discoveries convo | ✓ `services/messages.ts` | ✓ | ✓ |
| `notifyDiscoveryEngagement` (like/comment/share) | ✓ `services/discoveries.ts` | ✓ | ✓ |
| `notifyInviteAccepted` | ✓ `services/invites.ts` | ✓ | ✓ |
| `notifyInviteOpened` | ✓ `services/invites.ts` | ✓ | in-app only |
| `notifyInviteRegistered` | ✓ `services/invites.ts` | ✓ | ✓ |
| `notifyDiscoveryMessage` | ✓ `services/messages.ts` | ✓ | ✓ |
| `notifyTrustScoreIncreased` | ✓ `lib/shared-introducers.ts` | ✓ | ✓ |
| `notifySharedIntroducerDiscovered` | ✓ `lib/shared-introducers.ts` | ✓ | ✓ |
| `notifyVerification` | ✓ `services/phone-verification.ts` | ✓ | ✓ |
| Admin broadcast | ✓ `notification-service.ts` | ✓ | ✓ |

**Still defined but not emitted:** `introduction_mutual_connection`, `introduction_comment`, `introduction_liked`, `introduction_viewed` (notification), `invite_sent`, `message_mention`, `mutual_connection_found`, `discovery_trusted_post`, identity verification notifications.

**Admin category toggles** now enforced in `shouldDeliver()` via `getAdminCategoryField()`.

---

## 2. Analytics event audit

| Event | Status | Integration point |
|-------|--------|-------------------|
| `introduction_created` | ✓ | story publish |
| `introduction_viewed` | ✓ | `GET /api/stories/[id]` |
| `introduction_replied` | ✓ | message with story reference |
| `invite_sent/opened/accepted/registered` | ✓ | invites API + service |
| `discovery_*` (create/like/comment/share) | ✓ | discoveries service |
| `discovery_message_clicked` | ✓ | discoveries-origin message |
| `message_sent/received` | ✓ | messages service |
| `conversation_started` | ✓ | first message in thread |
| `trust_score_increased` | ✓ | shared introducers refresh |
| `new_shared_introducer` | ✓ | shared introducers refresh |
| `trust_profile_viewed` | ✓ | `GET /api/trust/[userId]` |
| `phone_verified` | ✓ | phone verification confirm |
| `push_enabled` / `app_installed` | ✓ | push subscribe / PWA install |
| `discovery_viewed` | ✓ client | `POST /api/analytics/track` |
| `shared_introducers_opened` | ✓ client | `POST /api/analytics/track` |

**Still unwired:** `introduction_shared`, `introduction_liked`, `introduction_expired`, `identity_verified` (no identity workflow yet).

Run `npm run audit:events` for a static wiring report.

---

## 3. Supabase Realtime — notifications

**Implemented:**
- RLS on `notifications` (SELECT/UPDATE own rows)
- `notifications` added to `supabase_realtime` publication
- `hooks/useRealtimeNotifications.ts` — INSERT/UPDATE subscription filtered by `user_id`
- `NotificationBell` — live unread badge + preview prepend on new notifications

**Requirements for live updates:**
1. Migration `202608` deployed (done)
2. Supabase Realtime enabled for project
3. User authenticated in browser (existing Supabase session)

**Fallback:** REST poll on dropdown open still works if Realtime unavailable.

---

## 4. Phone verification enforcement

**Implemented:**
- `users.phone` column + `phone_verification_challenges` table
- `POST/PATCH /api/verification/phone` — request code + confirm
- Twilio SMS when `TWILIO_*` env vars set; beta code via `PHONE_VERIFICATION_BETA_CODE`
- Gates in `lib/verification-gates.ts` enforced on:
  - `POST /api/messages`
  - `POST /api/stories`
  - `POST /api/discoveries`
- Suspended users redirected at `requireUser()`
- Profile UI: `PhoneVerificationPanel`

**Admin toggle:** `requirePhoneVerification` in `/admin` settings.

**Gap:** Identity verification (`requireIdentityVerification`) has gate logic but **no verification API** yet.

---

## 5. Reporting, blocking, moderation

**Implemented:**
- `user_blocks` — block/unblock via `/api/blocks`
- `content_reports` — report via `/api/reports`
- Block enforcement in messaging (API gate + `sendMessage`)
- Profile UI: `BlockUserButton`, `ReportContentButton`
- Admin: `AdminModerationPanel` at `/admin` — pending reports queue
- `users.suspended_at` + admin report resolution can suspend

**Gaps:**
- Blocks not yet filtered from discovery feed / search / introductions list
- No automated content removal from reports
- No admin user lookup/suspend UI beyond report resolution
- No appeal flow

---

## 6. Production-critical checklist

### Must configure before beta

| Item | Status |
|------|--------|
| `DATABASE_URL` / `DIRECT_URL` | Required |
| Supabase auth keys | Required |
| `RESEND_API_KEY` + verified domain | Required for email notifications |
| `NEXT_PUBLIC_VAPID_*` + `VAPID_PRIVATE_KEY` | Required for push |
| `TWILIO_*` or `PHONE_VERIFICATION_BETA_CODE` | Required if phone gate enabled |
| `ADMIN_EMAILS` | Required |
| Legal entity env vars | Required per README |
| Run `npm run db:rls` on Supabase | **Recommended** — many tables still lack RLS in live DB |

### Should fix before public beta

| Item | Risk |
|------|------|
| Rate limiting on API routes | Abuse / spam |
| Block filtering in feed/search | Harassment bypass |
| Identity verification API | Admin gate incomplete |
| `introduction_expired` cron + analytics | Stale content metrics |
| Email notification digests | Admin toggle exists, not implemented |
| Unbounded `getConversationList` | Performance at scale |
| Enable RLS on all Prisma tables | Data exposure |

### Nice to have

- Remaining notification types (introduction liked/viewed as notifications)
- Leaderboard analytics (most trusted users, active introducers)
- PostHog/ClickHouse analytics provider swap
- Redis notification queue

---

## 7. Manual test plan

```bash
npm run verify-database   # 120/120
npm run audit:events      # static wiring report
npm run build             # must pass
```

1. **Notification persistence:** Publish intro tagging user B → row in `notifications`, bell badge increments via Realtime.
2. **Analytics persistence:** Send message → rows for `message_sent`, `message_received`, `conversation_started` in `analytics_events`.
3. **Phone gate:** Enable `requirePhoneVerification` in admin → unverified user blocked from messaging; verify phone → gate clears.
4. **Block:** User A blocks B → B cannot message A (403).
5. **Report:** Submit report → appears in `/admin` moderation queue.
6. **Push/email:** Configure VAPID + Resend → trigger intro received → check channels.

---

## 8. Architecture (post-change)

```
Domain action → emitters.ts / analyticsService.track()
                     ↓
              PostgreSQL (notifications, analytics_events)
                     ↓
         Supabase Realtime (notifications INSERT) → NotificationBell badge
                     ↓
              Email (Resend) / Push (web-push)
```

---

## 9. Files added/modified (this pass)

**New:** migration `202608_moderation_verification_realtime`, `lib/verification-gates.ts`, `lib/analytics-client.ts`, `services/phone-verification.ts`, `services/moderation.ts`, `hooks/useRealtimeNotifications.ts`, verification/blocks/reports/admin-reports/analytics-track APIs, moderation + phone UI components, `scripts/audit-events.ts`.

**Modified:** emitters, messages, invites, notification-service, NotificationBell, TopBar, profile/admin pages, auth, stories/discoveries/messages API gates, schema, verify-database, policies.sql, .env.example.

---

## 10. Verdict

| Criterion | Ready? |
|-----------|--------|
| Closed beta (100–500 users) | **Yes**, with env config |
| Open beta (1k+ users) | **Partial** — add rate limits + block filtering + RLS |
| Public launch | **No** — identity verification, digests, moderation automation, scalability hardening |

**Recommended launch mode:** Invite-only closed beta with phone verification optional (off initially), monitoring via `/admin` analytics + moderation queue, enable phone gate after Twilio is configured.
