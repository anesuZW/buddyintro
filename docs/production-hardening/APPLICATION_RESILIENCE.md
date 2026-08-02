# APPLICATION_RESILIENCE

## Goal

Users never see raw digests or blank white screens when dependencies flap.

## Fixes

| Layer | Behaviour |
| --- | --- |
| Main layout | Catches non-redirect `requireUser` failures → `ServiceUnavailable` |
| Layout badges | Try/catch → zeros (never crash shell) |
| API auth | `requireUserApi` → **503** JSON on DB connectivity errors |
| API handlers | `withApiHandler` maps uncaught errors to structured JSON |
| Client upload/post | Friendly retry copy on **503** |

## Crash audit outcome

| Failure mode | Before | After |
| --- | --- | --- |
| Pooler down during page SSR | Application error digest | Temporarily unavailable UI |
| Pooler down during API mutate | Empty 500 | **503** `{ code: service_unavailable }` |
| CSRF mismatch | 403 JSON | unchanged (structured) |
| Invalid JSON / Zod | Often 500 | **422** on hardened routes |

## Remaining

- Not every admin/low-traffic route is wrapped; core user journeys are.
- True offline HTML for authenticated SSR still needs network (PWA caches assets, not personalized RSC).
