# FIXES_APPLIED

**Date:** 2026-08-01  
**Scope:** Release hardening for private beta

| ID | Severity | Fix | Files |
| --- | --- | --- | --- |
| PH-001 | High | Structured API errors + `withApiHandler` (DB → **503** JSON, not empty 500) | `lib/api-error.ts`, `lib/prisma-errors.ts` |
| PH-002 | High | `requireUserApi` / `requireAdminApi` catch DB outages → **503** | `lib/auth.ts` |
| PH-003 | High | Harden core routes: discoveries, stories, messages, feed, notifications, profile, trust recommendations | `app/api/**/route.ts` |
| PH-004 | High | Media upload maps DB outage → **503** structured reject | `app/api/media/upload/route.ts` |
| PH-005 | Medium | Push subscribe: `configured` flag; **503** if VAPID missing; safeParse | `app/api/push/subscribe/route.ts` |
| PH-006 | Medium | Client toasts for **503** on discoveries + uploads | `DiscoveriesComposer.tsx`, `hooks/useUpload.ts` |
| PH-007 | Medium | Validation → **422** (messages/profile/discoveries/stories) instead of thrown Zod 500 | various API routes |
| RC3-001 | High | CSRF loopback alias (prior RC) | `lib/security.ts` |
| RC3-002 | Critical | Service Unavailable shell on DB blip (prior RC) | `layout.tsx`, `layout-badges.ts`, `ServiceUnavailable.tsx` |

## Behaviour preserved

No changes to UI layout, story/recommendation ordering, trust math, visibility, permissions, or auth success paths.
