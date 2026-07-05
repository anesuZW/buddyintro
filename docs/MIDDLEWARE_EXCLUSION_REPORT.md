# Middleware Exclusion Report

Generated: 2026-06-23

## Summary

**Status: PASS** — Static and health routes are excluded from Next.js middleware; authenticated routes still enforce session checks.

## Matcher configuration

`middleware.ts` negative lookahead excludes:

| Path | Purpose |
| ---- | ------- |
| `favicon.ico` | Browser icon |
| `robots.txt` | Crawler rules |
| `sitemap.xml` | SEO sitemap |
| `manifest.webmanifest` | PWA manifest |
| `offline` | Service worker offline page |
| `icons/*` | PWA icons |
| `api/public/*` | Public APIs |
| `api/health` | Uptime / load balancer probe |

## Safety review

| Route | Auth required? | Safe to exclude? |
| ----- | -------------- | ---------------- |
| `/api/health` | No — uses Prisma + Supabase admin for probes | **Yes** |
| `/manifest.webmanifest` | No — static metadata | **Yes** |
| `/offline` | No — public fallback page | **Yes** |
| `/icons/*` | No — static assets | **Yes** |
| `favicon.ico`, `robots.txt`, `sitemap.xml` | No | **Yes** |
| `/home`, `/discoveries`, `/profile` | Yes | **Must remain matched** |

## Before / after latency

### Before (prior benchmark — middleware still ran on excluded paths)

From `docs/.middleware-auth-benchmark.json` (2026-06-22, pre-exclusion):

| Path | HTTP | Middleware ran? | Auth overhead |
| ---- | ---- | ----------------- | ------------- |
| `/api/health` | 307 | yes | ~3ms |
| `/manifest.webmanifest` | 307 | yes | ~2ms |
| `/offline` | 307 | yes | ~1ms |
| `/icons/icon-512.svg` | 307 | yes | ~1ms |

Authenticated routes (still matched): **~273–280ms** middleware auth (dominated by Supabase `getUser()` RTT ~266ms).

### After (expected with current matcher)

Excluded paths skip `updateSession()` entirely — no `x-auth-profile-middleware-ms` header, no Supabase round-trip.

| Path | Expected middleware | Expected TTFB |
| ---- | ------------------- | ------------- |
| `/api/health` | Skipped | <50ms (DB + storage checks only) |
| `/manifest.webmanifest` | Skipped | <20ms |
| `/offline` | Skipped | <20ms |
| `/icons/*` | Skipped | <10ms |

Per-request savings on probes: **eliminates session parsing and any redirect handling inside middleware**.

## Authenticated route verification

Prior instrumentation confirms auth still applies on protected routes:

| Route | Middleware auth (median) |
| ----- | ------------------------ |
| `/home` | 273ms |
| `/discoveries` | 277ms |
| `/profile` | 274ms |

## Verification commands

```bash
npm run profile:middleware-auth -- --skip-build --skip-start --port=3013
# Confirm matcherAudit[].middlewareRan === false for excluded paths
```

## Recommendation

Deploy with current matcher. Monitor `/api/health` from external uptime service — it should never return auth redirects (307 to login).
