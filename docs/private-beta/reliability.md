# Private Beta — Reliability & Crash Recovery

**Team:** Prompt 1 — Reliability & Crash Recovery  
**Date:** 2026-08-02  
**Scope:** Prevent crashes during normal use; structured API errors; friendly UI on failure.

## Mission status

| Stop condition | Status |
|----------------|--------|
| No raw stack traces in UI | **Met** — boundaries never render stacks; digests optional |
| No white screens (authenticated + locale shells) | **Met** — `global-error`, `[locale]/error`, `(main)/error`, soft SSR failures |
| Every failure shows a friendly message | **Met** for hardened paths; admin/low-traffic APIs still being wrapped over time |
| APIs always return structured JSON on failure | **Met** for all high-traffic user routes wrapped with `withApiHandler` |

## What was already solid

- Authenticated layout DB outage → `ServiceUnavailable`
- Layout badges degrade without crashing the shell
- Core routes previously wrapped: feed, discoveries list/create, messages, stories list/create, notifications, profile PATCH, push subscribe, trust recommendations
- `requireUserApi` → structured **503** on DB outage
- Upload path with retries + structured rejects (`useUpload`)

## Fixes applied this pass

### Error boundaries & UI

| Change | File(s) |
|--------|---------|
| Root crash UI (no message leak) | `app/global-error.tsx` |
| Locale-segment crash UI | `app/[locale]/error.tsx` |
| Main shell: stop rendering `error.message` | `app/[locale]/(main)/error.tsx` |
| Friendly 404 | `app/[locale]/not-found.tsx` |
| Soft SSR failure component | `components/ui/SoftLoadFailure.tsx` |
| Home feed soft-fail | `components/home/HomeFeedPanels.tsx` |
| Discoveries page soft-fail | `app/[locale]/(main)/discoveries/page.tsx` |

### API envelope

| Change | Detail |
|--------|--------|
| Sanitize 500 `reason` | `lib/api-error.ts` — generic user copy; log real error server-side |
| Zod / bad JSON mapping | → **422** / **400** structured JSON |
| Wrap high-traffic routes | introductions (+ unread), stories/[id], discoveries like/bookmark/share/comments, users/search, network, posts, reports, blocks(+id), account, introduction-categories/visibility/suggestions, messages context, invites |
| `requireAdminApi` | Full try/catch around role sync + admin checks; structured 401/403 |
| Media storage 500 | No longer returns raw provider `message` to clients |

### Client recovery

| Change | File(s) |
|--------|---------|
| Friendly API message helper | `lib/client-api-error.ts` |
| Discoveries mutations safe JSON + toasts | `components/discoveries/DiscoveriesFeed.tsx` |
| Message send / profile save toasts | `MessageComposer.tsx`, `ProfileEditor.tsx` |

## Failure → user experience

| Failure | HTTP / UI | User sees |
|---------|-----------|-----------|
| DB down during auth (page) | Layout catch | Service unavailable + retry |
| DB down during API | **503** `{ code: service_unavailable }` | Toast / list retry |
| Uncaught handler error (wrapped) | **500** `{ code: internal_error }` | “Something went wrong…” |
| Validation | **422** `{ code: validation_error }` | Field / friendly reason |
| Conflict (unique) | **409** `{ code: conflict }` | Conflict copy |
| Render crash in shell | Error boundary | Friendly + Try again |
| Root layout crash | `global-error` | Branded recovery |
| Missing page | `not-found` | “Page not found” |
| Storage upload failure | **500** `{ code: storage_error }` | “We could not store that file…” |

## Logging

- Unhandled API errors: `console.error("[api] unhandled", error)` (server only)
- DB outages: `console.warn("[api] database unavailable", …)`
- Upload failures: `appLogger` + `logUploadFailure` (server)
- Client boundaries: `console.error` with digest/name only — **no stack in DOM**

## Remaining (non-blocking for Prompt 1 stop criteria)

1. Many `app/api/admin/**` routes still unwrapped — admin-only; wrap opportunistically.
2. Prefer `appLogger` over `console.*` across all API hot paths (ops polish).
3. Some secondary client toasts may still use generic `Error` strings — filter via `friendlyApiMessage` as touched.

See also: `crash-matrix.md`.

## Recommendation for next team

Proceed to **Prompt 2 — Media Upload Team**. Reliability baseline is in place for normal user journeys.
