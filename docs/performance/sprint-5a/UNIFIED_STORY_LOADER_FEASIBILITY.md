# Unified Story Loader Feasibility Study

**Generated:** 2026-07-27

---

## Question

Can all `/home` Story consumers share one dataset?

**Answer: No — not without behaviour or performance regression.**

---

## Consumers that CANNOT share one loader

| Consumer | Why |
| --- | --- |
| Q4 Mutual author distinct | No `status`, `expiresAt`, or visibility filters — broader than visible pool |
| Q1 Trust sent | Independent `take: 5` on authored published — merging with Q2 requires dual top-5 logic |
| Q2 Trust received | Tag-based predicate orthogonal to author-based pool |
| Q3 Visible pool | Unbounded full includes + visibility gate — superset in rows but not in author-discovery semantics |

---

## Would unified loader require…

| Requirement | Assessment |
| --- | --- |
| Additional filtering | **Yes** — 4 projection functions minimum |
| Additional sorting | **Yes** — story bar regroup, feed merge, dual top-5 |
| Additional memory | **Yes** — must load full includes for all rows if single fetch |
| Additional CPU | **Yes** — visibility gate + 4 projections vs targeted queries |

---

## Latency analysis (quantitative)

### Established facts (Sprint 1–3)

- Pooler RTT ≈ **300–600 ms** per round trip (avg–p95 higher)
- SQL execution ≈ **0.05–0.2 ms** locally (EXPLAIN ANALYZE)
- Prisma overhead negligible

### Current `/home` Story round trips: **4**

| Scenario | Round trips | Est. pooler time (parallel), | Est. pooler time (sequential) |
| --- | --- | --- | --- |
| **Current (4 queries)** | 4 | ~600–1,200 ms* | ~2,400 ms |
| **Unified (1 mega-query)** | 1 | ~300–600 ms | ~300–600 ms |
| **Best case merge (3 queries)** | 3 | ~450–900 ms | ~1,800 ms |

\*Suspense branches run parallel — wall time ≈ max(queries), not sum.

### Mega-query cost

Single query loading **all** non-expired visible stories with full tags:

- Sprint 3 runtime: visible/bar query alone **624 ms–4.9 s** pooler-inclusive
- Adding Q1/Q2 rows: marginal SQL; same round trip
- **Risk:** Fetching MORE rows than Q1+Q2 `take:5` if merged via OR without careful limit — **memory + transfer time increase**

### Merge Q1+Q2 only (narrow unified trust loader)

| Metric | Estimate |
| --- | --- |
| Queries removed | **1** (2 → 1) |
| Pooler savings | **~300–600 ms** wall time if sequential; **~0 ms** if already parallel with Q3 |
| Implementation risk | Medium — must preserve independent top-5 semantics |
| **Verdict** | **Marginal benefit** — trust queries already parallel (~682+687 ms overlapping) |

### Merge Q4 into Q3

| Metric | Estimate |
| --- | --- |
| Feasibility | **No** — Q4 author set not derivable from visibility-filtered pool |
| Behaviour change | Would miss authors only visible via non-expired tag overlap outside pool |

---

## Query count vs latency

| Optimization | Query Δ | Latency Δ (est.) | Worth it? |
| --- | --- | --- | --- |
| Sprint 4 pool reuse | −1 | ~300–600 ms | ✅ Done |
| Merge Q1+Q2 | −1 | ~0–600 ms (parallel dependent) | ⚠️ Low ROI |
| Single mega-loader | −3 | Uncertain; may increase row payload | ❌ High risk |
| Remove Q4 | −1 | **Behaviour break** | ❌ |

---

## Feasibility verdict

| Loader type | Feasible? |
| --- | --- |
| Full unified loader (1 query) | **No** — behaviour/perf risk |
| Trust dual-loader (Q1+Q2 merge) | **Possible** — Sprint 5B optional, low gain |
| Extend visible pool (Q3) | **Done** (Sprint 4) |
| Eliminate Q4 | **No** |

---

## Recommendation preview

See `SPRINT5A_DECISION.md` — **Option B** unless Sprint 5B scopes narrowly to trust-query merge with regression proof.
