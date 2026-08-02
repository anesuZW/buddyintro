# CTO_RECOMMENDATIONS

**Phase:** Production Readiness — Phase 8  
**Generated:** 2026-07-31  
**Based on:** Verified evidence in this folder only

---

## Critical

### C1. Align database schema with Prisma (apply 0008–0011 correctly)

| Field | Detail |
| --- | --- |
| Expected impact | Restores authenticated app; unblocks all baselines |
| Complexity | Medium (history baseline + DDL) |
| Risk | **High** if blind `migrate deploy` of 0001 on populated DB |
| Est. perf improvement | Indirect — enables measurement; removes 500s |
| Dependencies | Working `DIRECT_URL` (or approved pooler DDL path); ops runbook |

**Do not** mark 0008 applied until `media_objects` exists.

### C2. Repair Prisma migration history (`_prisma_migrations`)

| Field | Detail |
| --- | --- |
| Expected impact | Safe future deploys; CI `check:migration-sync` meaningful |
| Complexity | Medium |
| Risk | High if resolve mis-marked |
| Est. perf improvement | None directly |
| Dependencies | C1 verification SQL |

### C3. Fix `DIRECT_URL` connectivity from ops/CI machines

| Field | Detail |
| --- | --- |
| Expected impact | Unblocks migrate tooling |
| Complexity | Low–Medium (DNS/network/Supabase project settings) |
| Risk | Low |
| Est. perf improvement | None |
| Dependencies | Infra access |

---

## High

### H1. Re-establish warm production runtime baseline after schema fix

| Field | Detail |
| --- | --- |
| Expected impact | Trustworthy numbers for Phase 2 |
| Complexity | Low |
| Risk | None |
| Est. perf improvement | Process only |
| Dependencies | C1 |

### H2. Reduce Auth middleware network cost (security-reviewed)

| Field | Detail |
| --- | --- |
| Expected impact | **~0.3–1.0 s** per navigation if network hop reduced |
| Complexity | Medium–High |
| Risk | **High** (auth correctness) |
| Est. perf improvement | Large for all routes including `/` |
| Dependencies | Supabase SSR guidance; no behavior change without review |

### H3. Address geographic RTT (co-locate app/DB or local/regional DB for prod & dev)

| Field | Detail |
| --- | --- |
| Expected impact | Largest latency win when pages are healthy (RTT 335→~40 ms) |
| Complexity | High (ops) |
| Risk | Medium |
| Est. perf improvement | **Multi-second** on `/home` under current query counts |
| Dependencies | Deployment topology decision |

---

## Medium

### M1. Add Suspense splits on `/discoveries` and `/profile` (after baseline)

| Field | Detail |
| --- | --- |
| Expected impact | Faster first paint; same total work |
| Complexity | Medium |
| Risk | Low–Med (UI timing only if skeletons careful) |
| Est. perf improvement | Perceived; TTFB shell improvement |
| Dependencies | H1 success baseline |

### M2. Profile outlier queries (mutual-author Story, heavy StoryTag) on healthy DB

| Field | Detail |
| --- | --- |
| Expected impact | Cut 1–4 s arms when outliers appear |
| Complexity | Medium |
| Risk | Medium |
| Est. perf improvement | Situational |
| Dependencies | H1 |

### M3. Configure `LOCAL_DATABASE_URL` for developer machines

| Field | Detail |
| --- | --- |
| Expected impact | Dev UX; faster iteration |
| Complexity | Medium |
| Risk | Low |
| Est. perf improvement | Dev only |
| Dependencies | Local Postgres provision |

---

## Low

### L1. Optional Sprint 5B trust Story×2 merge (measurement gate ≥200 ms)

| Field | Detail |
| --- | --- |
| Expected impact | 0–600 ms; often ~0 if parallel |
| Complexity | Low |
| Risk | Low |
| Est. perf improvement | Small |
| Dependencies | H1; prove wall-time win |

### L2. Bundle analyzer on discoveries / StoryUploader

| Field | Detail |
| --- | --- |
| Expected impact | Tens–hundreds ms after TTFB fixed |
| Complexity | Low–Medium |
| Risk | Low |
| Est. perf improvement | Secondary |
| Dependencies | H1 |

---

## Explicitly do NOT do next

| Work | Why |
| --- | --- |
| Another Story query-count / unified loader mega-sprint | Negligible vs schema + RTT; Sprint 5A Option B |
| Index-only projects without wall-time proof | SQL already sub-ms |
| Suppress Invalid hook warnings | Masks SSR failures |
| Cross-request caches / `unstable_cache` | Out of scope; staleness risk |
| Feature optimization while Main routes 500 | Not production-ready |

---

## Suggested Phase 2 focus

**Stability completion + measurement reset:**

1. Execute C1–C3 (schema + migration history + DIRECT_URL).  
2. Run H1 (warm `next start` baselines for `/home`, `/discoveries`, `/messages`, `/profile`).  
3. Only then prioritize H2/H3 latency work with numbers.
