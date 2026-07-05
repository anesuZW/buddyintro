# Production Benchmark Report

Generated: 2026-06-23T09:33:42.517Z

Environment: `next start` with `PROFILE_PRODUCTION=1`  
Base URL: `http://localhost:3012`  
Warm runs per route: 1 (median reported)  
User: `sim-0@simulation.buddyintro.test`

## Architecture

```mermaid
flowchart LR
  A[profile-production.ts] -->|Cookie session| B[next start]
  B --> C[Middleware auth timing]
  C --> D[Route handler / SSR page]
  D --> E[x-bench-* headers]
  D --> F[/api/bench/metrics/id]
  A -->|TTFB + total| E
  A -->|Page segments| F
```

Instrumentation is gated by `PROFILE_PRODUCTION=1` only — no behavior changes in normal deployments.

## Executive summary

Production benchmarking measures BuddyIntro after **Phase 1 auth deduplication** and **Phase 2A media signed-URL caching**. Middleware auth remains the largest fixed cost (~305ms median warm auth across routes). Prisma averages ~32ms on warm API routes; page totals include layout SSR and client-visible TTFB.

### Top warm bottlenecks (by segment)

| Route | Segment | ms |
| ----- | ------- | -- |
| /api/messages/[userId]/context | auth | 353 |
| /api/profile/insights | auth | 342 |
| /home | auth | 338 |
| /discoveries | auth | 310 |
| /introductions | auth | 292 |
| /api/discoveries | auth | 270 |
| /api/introductions | auth | 268 |
| /profile | auth | 267 |

## Production warm results

| Route | TTFB | Total | Auth | Prisma | External | Serialize | Server total |
| ----- | ---- | ----- | ---- | ------ | -------- | --------- | ------------ |
| /home | 437ms | 951ms | 338ms | 0ms | 0ms | 0ms | 951ms |
| /discoveries | 514ms | 530ms | 310ms | 0ms | 0ms | 0ms | 530ms |
| /introductions | 327ms | 327ms | 292ms | 0ms | 0ms | 0ms | 327ms |
| /profile | 414ms | 428ms | 267ms | 0ms | 0ms | 0ms | 428ms |
| /api/discoveries | 410ms | 411ms | 270ms | 4ms | 0ms | 2ms | 128ms |
| /api/introductions | 302ms | 303ms | 268ms | 18ms | 0ms | 2ms | 23ms |
| /api/messages/[userId]/context | 523ms | 523ms | 353ms | 228ms | 0ms | 0ms | 159ms |
| /api/profile/insights | 377ms | 377ms | 342ms | 5ms | 0ms | 0ms | 23ms |


## Cold vs Warm (production)

| Route | Cold total | Warm total | Speedup |
| ----- | ---------- | ---------- | ------- |
| /home | 1846ms | 951ms | 48% |
| /discoveries | 703ms | 530ms | 25% |
| /introductions | 429ms | 327ms | 24% |
| /profile | 451ms | 428ms | 5% |
| /api/discoveries | 477ms | 411ms | 14% |
| /api/introductions | 430ms | 303ms | 30% |
| /api/messages/[userId]/context | 610ms | 523ms | 14% |
| /api/profile/insights | 329ms | 377ms | -15% |


## Dev vs Production (warm median)

Baseline dev timings from `docs/PHASE2_PROFILING_REPORT.md` (`next dev`, Phase 2 warm). Re-run with `--compare-dev` for live dev samples.

| Route | Dev baseline | Prod warm | Delta |
| ----- | ------------ | --------- | ----- |
| /home | 616ms | 951ms | +335ms |
| /discoveries | — | 530ms | — |
| /introductions | — | 327ms | — |
| /profile | — | 428ms | — |
| /api/discoveries | 356ms | 411ms | +55ms |
| /api/introductions | 335ms | 303ms | -32ms |
| /api/messages/[userId]/context | 367ms | 523ms | +156ms |
| /api/profile/insights | 320ms | 377ms | +57ms |

Production is **faster on API routes** (no dev compilation). Page `/home` dev baseline includes client navigation overhead from Phase 2A media profiling.


## Methodology

- **TTFB**: client time until response headers received (fetch start → headers).
- **Total**: full response body download (client wall clock).
- **Auth / Prisma / External / Serialize**: `x-bench-*` response headers (API routes) or `/api/bench/metrics/{id}` after page render.
- **Cold**: first request per route on a freshly started `next start` process.
- **Warm**: median of 1 sequential requests per route.
- Script: `npm run profile:production`

## Notes

- Production removes dev compilation overhead; cold spikes on first route hit are smaller than `next dev`.
- Page routes include layout (`requireUser`, badges) plus page data — server total from page segment only; client total includes full HTML.
- Page **prisma** values sum individual query durations; parallel `Promise.all` pages (e.g. `/home`) over-count vs wall clock.
- Disable benchmark headers in real deployments: unset `PROFILE_PRODUCTION`.

## Ranked optimization opportunities

| Priority | Opportunity | Typical warm cost | Notes |
| -------- | ----------- | ----------------- | ----- |
| P0 | Middleware Supabase auth RTT | ~305ms avg auth | Still dominant after Phase 1; session refresh network hop |
| P1 | Message context graph fan-out | 228ms prisma | Dedupe ConversationContext + single graph index |
| P2 | Profile insights parallel counts | 5ms prisma | Consolidate 14 count queries |
| P3 | Page SSR data fan-out (/home) | 951ms total | Layout + page parallel fetches; consider streaming |
| P4 | Discoveries feed trust bulk | 4ms prisma | Already improved; watch N+1 on authors |
| P5 | Media signed URLs (cached) | external segment | Phase 2A cache removes repeat sign cost; cold miss still ~800ms |
