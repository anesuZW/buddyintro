# Implementation Sprints

**Sprint:** Performance Optimization Planning (READ-ONLY)  
**Generated:** 2026-07-26  
**Prerequisite:** All profiling reports in `docs/performance/`

Each sprint is independently deployable, behaviour-preserving, and must ship with before/after metrics.

---

## Sprint 0 — Baseline Lock (Prerequisite, 1–2 days)

**Goal:** Reproducible measurement before any optimization.

| Task | Owner | Deliverable |
|------|-------|-------------|
| Production build on CI | DevOps | `npm run build` green |
| Run `profile:database` + `capture-http-profile` on prod build | Eng | Baseline JSON committed to `docs/performance/baselines/` |
| Enable PROFILE in staging only | DevOps | Headers on staging |
| Document QA user + seed state | Eng | Repeatable test account |

**Exit criteria:** Two consecutive profile runs within 10% variance on query counts.

**Why first:** Cannot prove optimization without stable measurement.

---

## Sprint 1 — Supabase & Connection Layer (P0, ~1 week)

**Goal:** Reduce pooler RTT from ~455ms to <100ms (target 40ms in production region).

| # | Task | Files / area | Effort |
|---|------|--------------|--------|
| 1.1 | Set `DIRECT_URL` to direct DB host (non-pooler) | `.env`, deployment docs | S |
| 1.2 | Add `?pgbouncer=true&connection_limit=10` to DATABASE_URL | `.env`, `ecosystem.config.js` | S |
| 1.3 | Deploy app to same region as Supabase (us-east-1) | VPS / PM2 | M |
| 1.4 | Route migrations + DBA scripts to DIRECT_URL only | `audit-database.ts`, docs | S |
| 1.5 | Re-run `check-db-latency` — assert SELECT 1 p95 <100ms | CI script | S |
| 1.6 | Load test 10× parallel SELECT 1 — assert p95 <500ms | `CONNECTION_AUDIT` repeat | S |

**Expected outcome:**

| Metric | Before | After |
|--------|--------|-------|
| SELECT 1 p95 | 603ms | <100ms |
| /home DB time (18 q) | 8,190ms | ~720–1,800ms |
| Supabase pool client_wait | 20 | <5 |

**Why this sprint first:** 91% DB time reduction with zero application logic change. All subsequent sprints multiply on lower RTT.

**Rollback:** Revert env vars; no code rollback needed.

**Verification:**

```bash
npm run check-db-latency
npm run profile:database -- --skip-server
```

---

## Sprint 2 — Home Page Query Consolidation (P0/P1, ~1 week)

**Goal:** Reduce `/home` from 18 → 10 Prisma queries.

| # | Task | Detail | Queries saved |
|---|------|--------|---------------|
| 2.1 | Create `getHomeTagGraph(userId)` | Single CTE or 2 queries replacing 4 in `getHomeStoryContext` | **3–4** |
| 2.2 | Pass tag graph to `getTrustNetworkStats` | Eliminate duplicate StoryTag.findMany in stats | **2** |
| 2.3 | Merge recent story findMany in stats + feed | Shared `recentStories` slice | **1–2** |
| 2.4 | Ensure `introducerAuthorIds` always passed to `getStoryBarForViewer` | Prevent fallback StoryTag query | **0–1** |
| 2.5 | Snapshot test: StoryBar + FeedList + TrustDashboard | HTML/API diff | — |

**Expected outcome:**

| Metric | Before | After |
|--------|--------|-------|
| /home queries | 18 | 10 |
| /home DB @40ms RTT | 720ms | 400ms |
| /home warm page | ~8.6s* | ~2.5s* |

*At Sprint 1 RTT; lower if both sprints complete.

**Why second:** `/home` is highest query count + primary user landing page.

**Dependencies:** Sprint 1 for accurate timing.

**Risk:** MEDIUM — must verify identical feed ordering and stats numbers.

---

## Sprint 3 — Discoveries & Trust Pipeline (P1, ~1 week)

**Goal:** Reduce `/discoveries` from 12 → 8 queries; stabilize trust enrichment.

| # | Task | Detail | Queries saved |
|---|------|--------|---------------|
| 3.1 | `cache(getDiscoveriesNetworkAuthorIds)` | React cache by viewerId | **1** |
| 3.2 | `cache(listBlockedUserIds)` | React cache by viewerId | **1** |
| 3.3 | `getViewerNetworkContext` shared by feed + recommendations | Single UserConnection fetch | **1** |
| 3.4 | Rewrite getTrustProfilesBulk pair lookup | JOIN instead of OR array | 0 RTT; scale fix |
| 3.5 | `unstable_cache` trust enrichment 60s + invalidation tags | Optional if 3.1–3.4 insufficient | repeat views |
| 3.6 | Discoveries feed snapshot test | Same posts, order, trust profiles | — |

**Expected outcome:**

| Metric | Before | After |
|--------|--------|-------|
| /discoveries queries | 12 | 8 |
| /discoveries warm page | ~5.5s | ~1.8s |

**Why third:** Second-highest traffic page; trust pipeline is largest contributor after pooler.

---

## Sprint 4 — Auth, Analytics & Remaining Pages (P1/P2, ~1 week)

**Goal:** Remove blocking writes; clean up auth fallback; profile + viewer paths.

| # | Task | Detail | Queries saved |
|---|------|--------|---------------|
| 4.1 | Middleware auth headers always → eliminate getUser fallback | `lib/auth-trusted-headers` | 0 q; **−450ms** |
| 4.2 | Defer `analyticsService.track` on story viewer SSR | Queue to existing worker | **1–2** |
| 4.3 | Profile insights → client Suspense fetch | `analyticsService.queryUserInsights` | **2–4** defer |
| 4.4 | `cache(notificationService.getPreferences)` | Profile page | **0–1** |
| 4.5 | Story viewer: batch visibility + category gates | Reduce up to 4 gate queries to 1–2 | **2** |
| 4.6 | Messages: optional badge/inbox count share | Layout + API | **1** |

**Expected outcome:**

| Page | Before | After |
|------|--------|-------|
| Story viewer | ~4.5s | ~1.2s |
| /profile | ~4.6s | ~1.5s |
| /messages | ~3.6s | ~1.0s |

**Why fourth:** Lower traffic individually but removes latency spikes (auth 2303ms outlier, analytics blocking).

---

## Sprint 5 — Scale Hardening (P2/P3, optional ~1 week)

**Goal:** Prepare for 10k+ users without behaviour change.

| # | Task | Trigger |
|---|------|---------|
| 5.1 | Add `story_tags(tagged_user_id, story_id)` index | seq_scan > idx_scan at scale |
| 5.2 | Add `stories(status, created_at DESC)` index | Story feed slow EXPLAIN |
| 5.3 | Migrate module caches → unstable_cache | PM2 cluster >1 instance |
| 5.4 | Remove unused indexes (INDEX_AUDIT list) | Write amplification observed |
| 5.5 | Introduction graph background-only refresh | Never in request path |

**Why last:** Not needed at current row counts (70 stories, 71 tags). SQL execution already <1ms.

---

## Sprint Dependency Graph

```
Sprint 0 (baseline)
    ↓
Sprint 1 (Supabase) ──────────────────────────┐
    ↓                                           │
Sprint 2 (home queries)                         │
    ↓                                           │
Sprint 3 (discoveries)                          ├── cumulative gains
    ↓                                           │
Sprint 4 (auth/analytics/pages)                 │
    ↓                                           │
Sprint 5 (scale — optional) ←───────────────────┘
```

---

## Per-Sprint Measurement Template

```markdown
## Sprint N Results

| Page | Queries before | Queries after | DB ms before | DB ms after | Page ms before | Page ms after |
|------|----------------|---------------|--------------|-------------|----------------|---------------|
| /home | | | | | | |

### Regressions
- [ ] None

### Behaviour verification
- [ ] Feed snapshot match
- [ ] Badge counts match
- [ ] Auth still enforced
```

---

## Total Timeline

| Sprint | Duration | Cumulative improvement (est.) |
|--------|----------|-------------------------------|
| 0 | 2 days | 0% (baseline) |
| 1 | 1 week | **~60%** page time (RTT) |
| 2 | 1 week | **~73%** on /home |
| 3 | 1 week | **~67%** on /discoveries |
| 4 | 1 week | **~70%** fleet average |
| 5 | 1 week | Scale readiness |

**Total:** ~5–6 weeks engineering (4 core sprints + baseline + optional scale).

---

## What NOT to do in any sprint

- Change feed ordering algorithms
- Remove trust enrichment when settings require it
- Skip permission checks
- Add features disguised as performance work
- Deploy index changes without EXPLAIN evidence
