# Private Beta — Crash Matrix

**Date:** 2026-08-02  
Companion to `reliability.md`.

## Legend

| Symbol | Meaning |
|--------|---------|
| **OK** | Handled with friendly UX / structured JSON |
| **SOFT** | Degrades gracefully (empty/retry UI) |
| **GAP** | Remaining risk (documented) |

## Browser / render

| Scenario | Before | After | Status |
|----------|--------|-------|--------|
| Error in `(main)` page render | Shows `error.message` | Generic copy + Try again | **OK** |
| Error in `[locale]` auth/legal page | Next default | `[locale]/error.tsx` | **OK** |
| Error in root layout | Next “Application error” | `global-error.tsx` | **OK** |
| Invalid hook cascade after SSR blip | Raw message | Friendly hook copy | **OK** |
| Unknown URL | Default Next 404 | Locale `not-found.tsx` | **OK** |
| White screen (shell) | Possible on layout DB fail | Layout → `ServiceUnavailable` | **OK** |

## Server-rendered data

| Scenario | Behavior | Status |
|----------|----------|--------|
| Home feed DB failure | SoftLoadFailure + retry link | **OK** |
| Discoveries feed DB failure | SoftLoadFailure (page chrome kept) | **OK** |
| Layout badge query failure | Badges omitted | **OK** |
| `requireUser` DB failure | ServiceUnavailable | **OK** |

## API — user journeys

| Route family | Uncaught → empty 500? | Envelope |
|--------------|----------------------|----------|
| `/api/feed` | No | `withApiHandler` |
| `/api/discoveries` (+ like/bookmark/share/comments) | No | `withApiHandler` |
| `/api/messages` (+ context) | No | `withApiHandler` |
| `/api/stories` (+ `[id]`) | No | `withApiHandler` |
| `/api/introductions` (+ unread) | No | `withApiHandler` + perf |
| `/api/notifications` | No | `withApiHandler` |
| `/api/profile` PATCH | No | `withApiHandler` |
| `/api/users/search` | No | `withApiHandler` |
| `/api/network` | No | `withApiHandler` |
| `/api/posts` | No | `withApiHandler` + safeParse |
| `/api/reports` | No | `withApiHandler` + safeParse |
| `/api/blocks` | No | `withApiHandler` |
| `/api/account` | No | `withApiHandler` |
| `/api/invites` | No | `withApiHandler` |
| `/api/introduction-*` categories/visibility/suggestions | No | `withApiHandler` |
| `/api/push/subscribe` | No | `withApiHandler` |
| `/api/media/upload` | Local try/catch + sanitized 500 | **OK** |
| `/api/admin/**` | Mostly unwrapped | **GAP** (admin only) |

## Dependency failures

| Dependency | Client-visible result | Status |
|------------|----------------------|--------|
| Postgres unreachable (API) | 503 `service_unavailable` | **OK** |
| Postgres unreachable (page auth) | Service unavailable page | **OK** |
| Storage provider error | 500 `storage_error` (no internals) | **OK** |
| CSRF reject | Structured reject (existing) | **OK** |
| Zod validation throw (wrapped) | 422 `validation_error` | **OK** |
| Unique constraint | 409 `conflict` | **OK** |

## Client mutations

| Action | Failure UX | Status |
|--------|------------|--------|
| Discoveries like/bookmark/share/comment | Toast + no corrupt local state | **OK** |
| Send message | Friendly toast | **OK** |
| Profile save / avatar | Friendly toast | **OK** |
| Upload (useUpload) | Retries (5xx only) + progress + cancel in Story/Discoveries/Profile | **OK** |
| Messages/notifications/intro list load | ListError + retry | **OK** |

## Information disclosure

| Channel | Stack / internals to user? | Status |
|---------|---------------------------|--------|
| Error boundaries | No (digest only) | **OK** |
| API 500 `reason` | Generic only | **OK** |
| Upload storage 500 | Generic only | **OK** |
| Server logs | Full error retained | **OK** |

## Residual risk register

| ID | Risk | Severity | Notes |
|----|------|----------|-------|
| CR-01 | Admin API empty 500 | Medium | Admin console only |
| CR-02 | Rare client toast still shows raw Error | Low | Harden as files are touched |
| CR-03 | Parallel cold DB connects under outage | Medium | Infra; UX already 503 |

## Sign-off (Prompt 1)

Reliability team considers stop criteria met for **normal user use**.  
Proceed to Prompt 2 (Media Uploads).
