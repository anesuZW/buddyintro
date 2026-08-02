# Performance Targets

**Sprint:** Performance Optimization Planning (READ-ONLY)  
**Generated:** 2026-07-26  
**Baseline:** Database Performance Profiling Sprint (2026-07-26)

---

## Phase 10 — Fleet-Wide Projections

### Query Volume

| Metric | Current | After Sprint 2 | After Sprint 4 | Target (final) |
|--------|---------|----------------|----------------|----------------|
| Avg queries/page (authenticated) | **12.0** | **9.5** | **7.5** | **7.0** |
| /home queries | 18 | 10 | 10 | 10 |
| /discoveries queries | 12 | 12 | 8 | 8 |
| /profile queries | 10 | 10 | 7 | 7 |
| Peak queries/request | 18 | 12 | 10 | 10 |
| Duplicated queries/request | 3.5 | 1.5 | 0.5 | 0.5 |

### Database Latency

| Metric | Current | Sprint 1 (RTT) | Sprint 2–4 (queries) | Final target |
|--------|---------|----------------|----------------------|--------------|
| Pooler RTT avg | **455ms** | **40ms** | 40ms | **≤50ms** |
| Pooler RTT p95 | **603ms** | **80ms** | 80ms | **≤100ms** |
| SQL execution (EXPLAIN) | **0.1ms** | 0.1ms | 0.1ms | ≤5ms |
| /home DB time | **8,190ms** | 720ms | **400ms** | **≤500ms** |
| /discoveries DB time | **5,460ms** | 480ms | **320ms** | **≤400ms** |
| Avg page DB time | **5,500ms** | 480ms | **350ms** | **≤400ms** |

### Page Latency (Warm Production Build)

| Page | Current est. | Final target | Reduction |
|------|--------------|--------------|-----------|
| `/home` | 8.6s | **2.3s** | **73%** |
| `/discoveries` | 5.5s | **1.8s** | **67%** |
| `/profile` | 4.6s | **1.5s** | **67%** |
| `/introductions` | 3.6s | **1.2s** | **67%** |
| `/messages` | 3.6s | **1.0s** | **72%** |
| `/create-story` | 1.8s | **0.6s** | **67%** |
| Story viewer | 4.5s | **1.2s** | **73%** |
| **Fleet median** | **4.6s** | **1.5s** | **67%** |

**Components of target page time (example /home):**

| Segment | Target |
|---------|--------|
| Auth | 100ms |
| DB (10 queries × 40ms) | 400ms |
| Server render | 500ms |
| Serialize/stream | 300ms |
| Buffer | 1,000ms |
| **Total** | **~2.3s** |

### Server Render Time

| Metric | Current | Target |
|--------|---------|--------|
| RSC render (non-DB) | 700–800ms | **400–600ms** |
| Suspense boundary overhead | 3 on /home | 3 (unchanged) |
| Serialize (large includes) | 200–400ms | **100–200ms** (select trim) |

### Supabase Cost

| Metric | Current | Target | Reduction |
|--------|---------|--------|-----------|
| Billable query round-trips/user/session | ~50–80 | **25–40** | **~40%** |
| Pooler connection minutes | Baseline | **−30%** | Less hold time |
| Direct DB connections | 0 (all pooler) | Jobs/migrations only | Isolated |
| Egress | Low | Low | Unchanged |

*Exact pricing depends on Supabase plan tier; relative reduction from query count × RTT.*

### CPU (App Server)

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| Node CPU per request | Baseline | **−20%** | Less Prisma extension timing in prod |
| JSON serialize CPU | Baseline | **−15%** | Smaller selects |
| JS dedupe loops (messages) | O(n) on inbox | O(page size) | Already raw SQL ✓ |

### Memory

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| Heap per request | Baseline | **−10%** | Fewer large include trees |
| In-memory recs cache | 5min TTL Map | Same + bounded size | Add max entries |
| Prisma connection pool | Default | `connection_limit=10` | Predictable |

---

## SLA Targets (Production VPS)

| Metric | Target | Measurement |
|--------|--------|-------------|
| p50 page TTFB (auth, warm) | **<1.5s** | PROFILE_PRODUCTION headers |
| p95 page TTFB (auth, warm) | **<3.0s** | Same |
| p50 API JSON (auth) | **<500ms** | `/api/discoveries`, `/api/messages` |
| p95 pooler RTT | **<100ms** | `check-db-latency` cron |
| Max queries/request | **≤12** | Phase2 profiler |
| Error rate under load | **<0.1%** | Existing health monitoring |

---

## Before / After Summary Table

| Dimension | Current | Future | Δ |
|-----------|---------|--------|---|
| Avg queries/page | 12 | 7 | **−42%** |
| Avg pooler RTT | 455ms | 40ms | **−91%** |
| Avg page DB time | 5.5s | 0.35s | **−94%** |
| Avg warm page latency | 4.6s | 1.5s | **−67%** |
| /home page latency | 8.6s | 2.3s | **−73%** |
| Supabase query cost | 100% | ~55% | **−45%** |
| App CPU/request | 100% | ~80% | **−20%** |
| App memory/request | 100% | ~90% | **−10%** |

---

## Measurement Commands (Acceptance)

```bash
# Pooler baseline
npm run check-db-latency

# Full profile
npm run profile:database

# Page wall-clock (server running, prod build)
PROFILE_PRODUCTION=1 npm run start -- -p 3010
npm run profile:http-capture -- --base=http://localhost:3010

# Assert targets
# SELECT 1 p95 < 100ms
# /home queries <= 10
# /home warm total < 3000ms (production, same region)
```

---

## Non-Targets (Explicit)

These will **not** change in optimization sprints:

- Feed content visible to user
- Trust scores and enrichment when enabled
- Notification badge semantics
- Auth requirements
- Story visibility rules
- Introduction categories available

---

## Risk Register

| Target | Risk if missed | Mitigation |
|--------|----------------|------------|
| 40ms RTT | Page time stays >5s | Sprint 1 mandatory |
| 10 queries/home | Partial gain only | Sprint 2 mandatory |
| 2.3s /home | UX still sluggish | Combine Sprint 1+2 |
| Cost −45% | Less savings | Query count still reduces cost linearly |

---

## Related Documents

- [OPTIMIZATION_ROADMAP.md](./OPTIMIZATION_ROADMAP.md) — Master plan
- [IMPLEMENTATION_SPRINTS.md](./IMPLEMENTATION_SPRINTS.md) — Sprint order
- [PAGE_OPTIMIZATION_ESTIMATES.md](./PAGE_OPTIMIZATION_ESTIMATES.md) — Per-page detail
- [QUERY_REDUCTION_PLAN.md](./QUERY_REDUCTION_PLAN.md) — Exact query elimination
- [SUPABASE_OPTIMIZATION.md](./SUPABASE_OPTIMIZATION.md) — RTT modeling
