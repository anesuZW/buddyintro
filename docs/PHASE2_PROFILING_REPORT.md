# Phase 2 Profiling Report

Generated: 2026-06-21  
Environment: local dev (`PROFILE_PHASE2=1`, Phase 1 auth headers active)  
Collection: `npm run profile:phase2 -- --base=http://localhost:3003 --runs=3` + server `[PROFILE]` logs

## Executive summary

After Phase 1 auth deduplication, **middleware Supabase auth (~270–380ms)** remains the largest fixed cost on every request. The 1–3s spikes on these routes come from **different secondary bottlenecks**:

| Route | Primary spike cause | Warm handler time |
| ----- | ------------------- | ----------------- |
| `/api/messages/[userId]/context` | Graph/context Prisma fan-out (15+ queries, repeated lookups) | ~62ms (+ ~305ms middleware) |
| `/api/notifications/preferences` | Middleware auth + **upsert-on-GET** | ~14ms (+ ~310ms middleware) |
| `/api/introduction-categories` | Middleware auth (data cached after first hit) | ~5ms (+ ~300ms middleware) |
| `/api/media` | **Supabase signed-URL API** (295–814ms) + middleware auth | ~302ms (+ ~335ms middleware) |

Prisma itself is healthy (~5–22ms for simple routes; ~50–160ms for chat context graph). Occasional **multi-second client wall times** are dominated by middleware RTT, dev compilation (first hit), and `/api/media` redirect follow fetching the asset.

---

## Methodology

### Instrumentation added (no business logic changes)

| File | Purpose |
| ---- | ------- |
| `lib/profile/phase2-profiler.ts` | `[PROFILE]` logging, issue detection, segment timers |
| `lib/perf/context.ts` | Feeds per-query Prisma timings into phase-2 profiler |
| `app/api/messages/[userId]/context/route.ts` | Segment profiling |
| `app/api/notifications/preferences/route.ts` | Segment profiling |
| `app/api/introduction-categories/route.ts` | Segment profiling |
| `app/api/media/route.ts` | Segment profiling |
| `scripts/profile-phase2-routes.ts` | Authenticated wall-clock collection (`npm run profile:phase2`) |

Enable logging:

```bash
PROFILE_PHASE2=1 npm run dev
npm run profile:phase2
```

### Log format

```text
[PROFILE]
route=/api/messages/[userId]/context
middlewareAuth=305 ms
routeAuth=6 ms
auth=311 ms
prisma=161 ms
prisma[StoryTag.findMany] x5=53 ms
prisma[ConversationContext.findUnique] x2=38 ms
...
external=0 ms
storage=0 ms
serialize=0 ms
response=0 ms
total=62 ms
chatContext=55 ms
[PROFILE-ISSUE] repeated-query: ConversationContext.findUnique executed 2 times (38ms total)
```

**Note:** `routeAuth` wraps `requireUser()` / `getCurrentUser()` and includes **Prisma user load (~5ms)**, not a second Supabase `getUser()` (Phase 1 uses `source=middleware-headers`, 0ms network).

**End-to-end time** ≈ `middlewareAuth` + handler `total` (handler timer starts after middleware).

---

## Route 1: `/api/messages/[userId]/context`

### Warm timing breakdown (median of 3 runs)

| Segment | ms | % of end-to-end (~367ms) |
| ------- | -- | ------------------------ |
| Middleware auth | 305 | **83%** |
| Route auth segment (`requireUser`) | 6 | 2% |
| Access control (`canAccessChatContext`) | 0 | 0% |
| Chat context (`getChatContextPayload`) | 55 | **15%** |
| Serialize | 0 | 0% |
| Response construction | 0 | 0% |
| **Handler total** | **62** | |
| **Estimated end-to-end** | **~367** | |
| Client wall (script median) | 476 | includes variance / TLS |

### Prisma query breakdown (detailed run, graph enabled)

| Query | Count | Total ms |
| ----- | ----- | -------- |
| `User.findUnique` | 3 | 31 |
| `StoryTag.findMany` | 5 | 53 |
| `ConversationContext.findUnique` | 2 | 38 |
| `UserConnection.findUnique` | 1 | 17 |
| `SharedIntroducerRelationship.findMany` | 1 | 14 |
| `SharedIntroducerRelationship.count` | 1 | 8 |
| `AdminSettings.findUnique` | 1 | (in parallel) |
| **Prisma total** | **~15** | **~161** |

### Issues detected

| Issue | Detail |
| ----- | ------ |
| **Repeated query** | `ConversationContext.findUnique` ×2 — `getChatContextPayload` calls `getConversationContext` and `getOriginatingStoryForConversation`, which re-fetches the same row |
| **Repeated query** | `StoryTag.findMany` ×5 — introduction graph path (`buildGraphIndex`, mutual introducers, path chain) |
| **Repeated user lookup** | `User.findUnique` ×3 — `requireUser`, access gate, trust/graph paths |
| **N+1 pattern** | Multiple graph helpers each call `buildGraphIndex()` (React `cache()` helps within one request after first call) |
| **Expensive includes** | `ConversationContext.findUnique` includes story + discoveriesPost |
| **Sequential work** | Graph block runs after first `Promise.all`; could overlap with access check in theory, but access must run first |

### Recommendations

| Priority | Change | Est. savings |
| -------- | ------ | ------------ |
| High | Pass `context` into `getOriginatingStoryForConversation` to avoid 2nd `ConversationContext.findUnique` | **~20–40ms** Prisma |
| High | Cache `buildGraphIndex()` per request (already React-cached) + materialized graph for chat | **~30–80ms** on cold graph |
| Medium | Batch graph queries / reduce `StoryTag.findMany` fan-out | **~40–100ms** |
| Medium | Single `getCurrentUser()` at route — avoid redundant `User.findUnique` in access + handler | **~10–20ms** |
| Low | Middleware auth RTT (infra / session strategy) | **~200–300ms** (outside route code) |

---

## Route 2: `/api/notifications/preferences`

### Warm timing breakdown

| Segment | ms | % of end-to-end (~324ms) |
| ------- | -- | ------------------------ |
| Middleware auth | 310 | **95%** |
| Route auth segment (`getCurrentUser`) | 6 | 2% |
| Query preferences (`getOrCreatePreferences`) | 7 | **2%** |
| Serialize | 0 | 0% |
| Response | 1 | 0% |
| **Handler total** | **14** | |
| **Estimated end-to-end** | **~324** | |
| Client wall (script median) | 457 | |

### Prisma query breakdown

| Query | Count | Total ms |
| ----- | ----- | -------- |
| `User.findUnique` | 1 | ~5 (in routeAuth segment) |
| `NotificationPreferences.upsert` | 1 | ~7 |

### Issues detected

| Issue | Detail |
| ----- | ------ |
| **Unnecessary upsert on GET** | `getPreferences()` → `getOrCreatePreferences()` uses `upsert` with `update: {}` on every read |
| **Write amplification** | Upsert may acquire row lock / generate WAL even when row exists |
| No duplicate Supabase auth | Phase 1 confirmed (`supabaseGetUser=0ms`) |

### Recommendations

| Priority | Change | Est. savings |
| -------- | ------ | ------------ |
| **High** | Replace GET path with `findUnique`; create only on 404 / lazy migrate | **~5–15ms** Prisma + reduced DB write load |
| Medium | Cache preferences per user in memory (short TTL) | **~7ms** per repeat hit |
| Low | Middleware auth RTT | **~250–350ms** |

**Why this route still feels slow (~450ms wall):** ~95% is middleware Supabase validation, not preferences logic.

---

## Route 3: `/api/introduction-categories`

### Warm timing breakdown

| Segment | ms | % of end-to-end (~324ms) |
| ------- | -- | ------------------------ |
| Middleware auth | 301 | **98%** |
| Route auth segment (`requireUser`) | 5 | 2% |
| List categories (`listIntroductionCategoriesCached`) | 0 | 0% (in-memory cache hit) |
| Serialize | 0 | 0% |
| **Handler total** | **5** | |
| **Estimated end-to-end** | **~324** | |
| Client wall (script median) | 396 | |

### Prisma query breakdown

**Cold (first request after cache expiry):**

| Query | ms |
| ----- | -- |
| `AdminSettings.findUnique` | ~10 |
| `IntroductionCategory.findMany` | ~12 |
| `User.findUnique` (auth) | ~5 |

**Warm:** 0 Prisma queries in `listCategories` segment (module cache + React `cache()`).

### Issues detected

| Issue | Detail |
| ----- | ------ |
| None critical on warm path | Route is already optimized with 5-minute cache |
| Cold spike | First hit pays AdminSettings + findMany + compilation |
| Double auth call avoided | Phase 1 working |

### Recommendations

| Priority | Change | Est. savings |
| -------- | ------ | ------------ |
| Low | SSR seed categories (already done elsewhere) — avoid client fetch entirely | eliminates route call |
| Low | Middleware auth RTT | **~250–350ms** |
| None needed | Business logic for warm path | — |

---

## Route 4: `/api/media`

### Warm timing breakdown (307 redirect to signed URL)

| Segment | ms | % of handler (~637ms) |
| ------- | -- | --------------------- |
| Middleware auth | 335 | 53% |
| Route auth segment (`requireUser`) | 6 | 1% |
| Access control (`canAccessStoragePath`) | 0 | 0% (owner image path — fast allow) |
| **External** (`signStoragePath` → Supabase Storage API) | **295–814** | **46–72% of handler** |
| Response (redirect) | 0 | 0% |
| **Handler total** | **302–832** | |
| **Estimated end-to-end** | **~637–1167** | |
| Client wall (script median, **follows redirect**) | **2352** | includes downloading remote asset |

### Prisma query breakdown

| Query | Count | ms |
| ----- | ----- | -- |
| `User.findUnique` (auth) | 1 | ~5 |
| None in access path for own `{userId}/image/*` | — | 0 |

For **non-owner story media**, access control adds:

| Query | Purpose |
| ----- | ------- |
| `Story.findFirst` (mediaUrl contains) | Locate story by path |
| `getStoryForViewer` | Visibility gate (multiple queries) |

### Issues detected

| Issue | Detail |
| ----- | ------ |
| **External latency** | `createSignedUrl` round-trip to Supabase Storage dominates handler |
| **Client wall inflation** | Fetch follows 307 redirect and downloads full image (~2s+ for large PNG) |
| **Sequential** | Access check → sign URL (cannot parallelize sign before authz) |
| Variable external time | 295ms (warm) → 814ms (cold) on same path |

### Recommendations

| Priority | Change | Est. savings |
| -------- | ------ | ------------ |
| **High** | Return signed URL JSON for client-side fetch instead of server redirect (avoid double hop in profiling) | **~200–800ms** perceived |
| **High** | Cache signed URLs in memory keyed by path (TTL < expiry) | **~250–500ms** on repeat |
| Medium | CDN/public bucket for avatar `{userId}/image/*` with auth at upload only | removes sign call entirely |
| Medium | Middleware auth RTT | **~250–350ms** |

---

## Cross-route comparison (warm)

| Route | Middleware | Handler | Dominant handler cost | Duplicate auth |
| ----- | ---------- | ------- | --------------------- | -------------- |
| Messages context | ~305ms | ~62ms | Prisma graph (~55ms segment) | No |
| Notifications prefs | ~310ms | ~14ms | Upsert read (~7ms) | No |
| Intro categories | ~301ms | ~5ms | None (cached) | No |
| Media | ~335ms | ~302ms | Supabase sign URL (~295ms) | No |

```text
End-to-end budget (typical warm API call):

Middleware auth     ████████████████████████████  ~300ms  (~85%)
Handler business    ██                            ~15–60ms (~15%)
  └─ Prisma         █                             ~5–55ms
  └─ External       ████████ (media only)         ~295ms
```

---

## Root causes of 1–3 second responses

| Cause | Affects | Typical cost |
| ----- | ------- | ------------ |
| Middleware Supabase `getUser()` RTT | All routes | 270–600ms |
| Dev compilation (first hit) | All routes | 1–10s once |
| Chat context graph Prisma fan-out | Messages context | 50–200ms (+ spikes to 2s on cold graph index) |
| Supabase Storage `createSignedUrl` | Media | 300–800ms |
| Client redirect + download | Media (wall clock) | 1–2s+ |
| GET upsert | Notifications prefs | 7–25ms (+ write overhead) |

---

## Instrumentation-only changes (this pass)

No authorization rules, query logic, or caching behavior were modified. Profiling can be disabled by unsetting `PROFILE_PHASE2`.

---

## Suggested optimization order (future work — not implemented)

1. **Notifications GET:** `findUnique` instead of `upsert` — quick win, ~5–15ms + less DB write load  
2. **Media:** signed-URL cache + avoid redirect in hot path — **~300–800ms**  
3. **Messages context:** dedupe `ConversationContext` fetch — **~20–40ms**  
4. **Messages context:** reduce graph query fan-out — **~50–100ms**  
5. **Platform:** middleware session/JWT strategy — **~250–350ms** all routes  

---

*Report based on measured `[PROFILE]` logs and `npm run profile:phase2` wall-clock samples. Re-run after production build for compile-free numbers.*
