# API_HARDENING

## Shared helpers

- `lib/api-error.ts` — `apiJson`, `serviceUnavailableResponse`, `mapUnknownErrorToResponse`, `withApiHandler`
- `lib/prisma-errors.ts` — `isPrismaConnectivityError` (`P1001` et al.)

## Status code policy (hardened routes)

| Code | When |
| --- | --- |
| 401 | Unauthenticated |
| 403 | Suspended / CSRF / invite gate / forbidden |
| 404 | (existing resource routes) |
| 409 | Unique conflict |
| 422 | Invalid / invalid JSON |
| 429 | Rate limit (existing) |
| 503 | DB / dependency unavailable |
| 500 | Unexpected (always JSON `{ error, code }`) |

## Verified (`artifacts/harden-smoke.json`, :3070)

| Check | Status |
| --- | --- |
| Unauth `/api/feed` | **401** JSON |
| Authed feed/discoveries/messages/stories/notifications | **200** |
| Discovery create | **201** |
| Evil Origin POST | **403** `csrf_rejected` |
| Bad message UUID | **422** `validation_error` |
| Push subscribe GET | **200** `configured: true` |

## Auth behaviour unchanged

Successful sessions still resolve the same user; only failure envelopes improved.
