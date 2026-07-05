# Auth Profiling Results

Generated: 2026-06-21T21:02:35.442Z

## Methodology

- Instrumentation gated by `AUTH_PROFILE=1` (middleware + `lib/auth.ts` helpers).
- Request correlation via `x-auth-profile-id` header (8-char UUID prefix).
- API routes expose segment timings on response headers for automated collection.
- Script: `npm run profile:auth` — signs in as `user1@friendintro.com`, hits each route 3×, reports median.
- Base URL: `http://localhost:3002`

## Per-route breakdown

| Route | Middleware Auth | Route Auth | Prisma | Other | Serialize | Total (wall) | getUser() calls | Duplicate |
| ----- | --------------- | ---------- | ------ | ----- | --------- | ------------ | --------------- | --------- |
| /api/trust/recommendations | 294ms | 0ms | 5ms | 0ms | 0ms | 7ms | 1 | no |
| /api/discoveries | 282ms | 0ms | 4ms | 54ms | 0ms | 60ms | 1 | no |
| /api/introductions | 256ms | 0ms | 4ms | 8ms | 0ms | 12ms | 1 | no |
| /api/profile/insights | 286ms | 0ms | 4ms | 29ms | 0ms | 39ms | 1 | no |
| /api/notifications/preferences | 604ms | 0ms | 4ms | 5ms | 0ms | 10ms | 1 | no |
| /home | 362ms | 0ms | 0ms | 488ms | 0ms | 850ms | 1 | no |
| /discoveries | 398ms | 0ms | 0ms | 138ms | 0ms | 536ms | 1 | no |
| /introductions | 281ms | 0ms | 0ms | 137ms | 0ms | 418ms | 1 | no |
| /profile | 301ms | 0ms | 0ms | 128ms | 0ms | 429ms | 1 | no |

**Notes on pages:** Page responses include middleware auth headers only. Route-level `getAuthUser()` / Prisma timings are logged server-side as `[AUTH-PROFILE][id]` lines (see Duplicate auth analysis). Total for pages uses fetch wall time.

## Duplicate auth analysis

| Route | Middleware `getUser()` | Route `getUser()` | Total `getUser()` calls | Duplicate? |
| ----- | ------------------------ | ------------------- | ------------------------- | ---------- |
| /api/trust/recommendations | yes (294ms) | no (0ms) | 1 | no |
| /api/discoveries | yes (282ms) | no (0ms) | 1 | no |
| /api/introductions | yes (256ms) | no (0ms) | 1 | no |
| /api/profile/insights | yes (286ms) | no (0ms) | 1 | no |
| /api/notifications/preferences | yes (604ms) | no (0ms) | 1 | no |
| /home | yes (362ms) | yes (logged) (0ms) | 1 | no |
| /discoveries | yes (398ms) | yes (logged) (0ms) | 1 | no |
| /introductions | yes (281ms) | yes (logged) (0ms) | 1 | no |
| /profile | yes (301ms) | yes (logged) (0ms) | 1 | no |

### Evidence

0/5 measured API routes show **two** `getUser()` network calls per request (middleware + `getAuthUser()`).

Example log pattern per request:

```text
[AUTH-PROFILE][abc12345] middleware getUser=687ms path=/api/discoveries
[AUTH-PROFILE][abc12345] getAuthUser supabaseGetUser=702ms total=705ms
[AUTH-PROFILE][abc12345] getCurrentUser getAuthUser=705ms prismaUserLookup=11ms total=716ms
[AUTH-PROFILE][abc12345] route-summary /api/discoveries duplicateAuth=yes getUserCalls=2
```

Shared `[AUTH-PROFILE][id]` prefix proves both calls belong to the same HTTP request.

## Segment averages (API routes)

| Segment | Median avg |
| ------- | ---------- |
| Middleware auth | 344ms |
| Route auth (`getAuthUser`) | 0ms |
| Prisma user lookup | 4ms |

## Savings estimate

If route-level `supabase.auth.getUser()` is removed (Phase 1 header pass-through):

| Metric | Value |
| ------ | ----- |
| Estimated savings per API request | **~0ms** (median route auth time) |
| Estimated savings per page navigation | **~0ms** + layout/page share one handler auth today |
| Duplicate `getUser()` calls eliminated | 1 per authenticated request |

Combined auth overhead today (middleware + route): **~344ms** typical on API routes vs **~344ms** after Phase 1.

## Recommendation

**Collect additional samples before proceeding.** Duplicate auth was not conclusively measured on this run — ensure `AUTH_PROFILE=1` is set on the dev server and re-run `npm run profile:auth`.

---

*Instrumentation only — no auth behavior changes. Disable profiling by unsetting `AUTH_PROFILE`.*
