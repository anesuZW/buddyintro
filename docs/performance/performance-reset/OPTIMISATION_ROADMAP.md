# Optimisation Roadmap

**Sprint:** Performance Reset (READ-ONLY)  
**Generated:** 2026-07-31  
**Rule:** Recommendations only — **no implementation in this sprint.**

---

## Priority order (evidence-based)

### P0 — Unblock correctness / measurement

| Action | Expected improvement | Complexity | Risk | Confidence |
| --- | --- | --- | --- | --- |
| Align DB schema with Prisma (`preferred_language` etc.) | Restores authenticated pages; enables real benchmarks | Low | Medium (migration) | **High** |
| Re-run warm prod-like `/home` trace after alignment | Evidence quality | Low | None | High |

### P1 — Attack RTT floor (largest impact)

| Action | Expected improvement | Complexity | Risk | Confidence |
| --- | --- | --- | --- | --- |
| Co-locate app with DB region (or regional pooler closer to users) | Warm `/home` DB time **~5×–10×** if RTT 335→40 ms | Ops / infra | Medium | **High** |
| Use true direct/local Postgres for developer machines | Dev feels like June ~400 ms era | Ops | Low | High |
| Connection pooling tuning / PgBouncer settings review | Reduce connect spikes (live connect 2.7 s) | Medium | Medium | Medium |

### P2 — Auth path latency

| Action | Expected improvement | Complexity | Risk | Confidence |
| --- | --- | --- | --- | --- |
| Measure whether middleware `getUser` can be shortened safely (JWT verify locally vs network) per Supabase SSR guidance | **0.5–1.0 s**/nav if network hop removed | Medium–High | **High** (security) | Medium |
| Avoid full remote auth work on public landing if product allows | Landing TTFB −1–2 s | Medium | Medium | Medium |

### P3 — Critical-path query outliers (not mega-merge)

| Action | Expected improvement | Complexity | Risk | Confidence |
| --- | --- | --- | --- | --- |
| Profile mutual-author Story.findMany (rows, EXPLAIN under load) | Cut 1–4 s feed arm when outlier | Medium | Medium | Medium |
| Profile slow StoryTag scan B & recommendations UserConnection | Similar | Medium | Medium | Medium |
| Optional Sprint 5B: merge trust recent Story×2 **only** with ≥200 ms gate | 0–600 ms; often ~0 if already parallel | Low | Low | Medium |

### P4 — UX delivery structure

| Action | Expected improvement | Complexity | Risk | Confidence |
| --- | --- | --- | --- | --- |
| Add Suspense splits to `/discoveries` and `/profile` | Faster first paint; same total work | Medium | Low–Med | Medium |
| Keep `/home` streaming; ensure skeletons match final layout (CLS) | Perceived speed | Low | Low | Medium |

### P5 — Assets (after TTFB fixed)

| Action | Expected improvement | Complexity | Risk | Confidence |
| --- | --- | --- | --- | --- |
| Wire bundle analyzer; trim discoveries / StoryUploader | 50–150 ms on heavy routes | Medium | Low | Medium |
| Production-only perf validation (not `next dev`) | Honest numbers | Low | None | High |

---

## Explicitly deprioritized

| Idea | Why |
| --- | --- |
| Full Unified Story Loader | Sprint 5A Option B — complexity &gt; gain |
| More React `cache()` without measured dupes | Dupes largely gone |
| Index-only projects without EXPLAIN proof of wall-time win | SQL already &lt;1 ms |
| Cross-request caches / `unstable_cache` | Prior sprint rules; staleness risk |

---

## Suggested next sprint shape

1. **Reset-0:** Schema alignment + warm production baseline (measurement only).  
2. **Reset-1:** Infra RTT (region/local DB) — expect largest user-visible win.  
3. **Reset-2:** Auth middleware latency review (security-reviewed).  
4. **Reset-3:** Outlier query remediation + discoveries/profile streaming.

Do not start another query-count sprint until RTT and Auth budgets are re-measured.
