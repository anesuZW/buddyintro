# Performance — Production Readiness

**Date:** 2026-07-26  
**Baseline:** `docs/performance/PERFORMANCE_BASELINE.md`, `docs/performance/PERFORMANCE_RECOVERY.md`

---

## Verdict

**No performance regressions introduced in launch prep.** Prior sprint optimizations remain in place.

---

## Optimizations already shipped (do not redo)

| Optimization | Location |
|--------------|----------|
| Lite health endpoint | `app/api/health/route.ts` |
| Prisma query timing gated | `lib/prisma.ts` |
| Request-scoped caches | `lib/discoveries-network.ts`, `lib/access-control.ts`, `services/moderation.ts` |
| Discovery mutation parallelization | `services/discoveries.ts` |
| Unread message index | Migration `0011_message_unread_index` |

---

## Production latency expectations (Supabase pooler)

| Endpoint | Warm (typical) | Notes |
|----------|----------------|-------|
| `GET /api/health` | 300–900 ms | Lite probe |
| `GET /api/feed` | 2–4 s | Trust graph + stories |
| `GET /api/discoveries` | 3–9 s | Network author resolution |
| `POST /api/media/upload` | 2–4 s | Storage + optional sharp/ffmpeg |

VPS in same region as Supabase should improve vs local dev.

---

## Duplicate fetches

| Area | Status |
|------|--------|
| Messages SSR + realtime | Bootstrap from SSR; realtime skips duplicate full fetch when `initialMessages` provided |
| Discovery feed | Bulk trust/reason queries (not N+1 per post) |
| Layout badges | Single count queries with index 0011 |

---

## Polling / websockets

| Component | Behavior |
|-----------|------------|
| `useRealtimeMessages` | Single Supabase channel per chat; cleanup on unmount |
| Push worker | BullMQ when `REDIS_URL` set; falls back to DB job queue |
| Health soak (RC2) | No duplicate websocket leaks observed |

---

## Memory / listeners

| Check | RC2 long session |
|-------|------------------|
| 30 min API poll | Recovered after server restart; no memory growth evidence in automation |
| React StrictMode | Enabled — double mount in dev only |
| Service worker | `no-cache` on `/sw.js` |

---

## Bundle size (production build — prior)

| Route | First Load JS |
|-------|---------------|
| `/home` | ~100–120 kB (see hardening report) |
| `/discoveries` | Similar |

No new client components added in launch prep.

---

## Client component audit

No changes in this sprint. Prior hardening added ARIA labels only (no bundle impact).

---

## VPS recommendations

| Setting | Value |
|---------|-------|
| PM2 instances | `PM2_INSTANCES=2` on 2-vCPU (leave 1 core for workers) |
| Node heap | `max_memory_restart: 750M` (production ecosystem) |
| Nginx | `proxy_buffering off` for uploads |
| ffmpeg | Required on PATH for video transcoding (local provider) |
| Redis | Recommended for media/push queue throughput |

---

## Monitoring thresholds (suggested)

| Metric | Warn | Critical |
|--------|------|----------|
| `GET /api/health` p95 | > 2 s | > 5 s |
| `GET /api/feed` p95 | > 8 s | > 15 s |
| PM2 restarts/hour | > 3 | > 10 |
| Memory per instance | > 600 MB | > 750 MB (auto restart) |
