# ROOT_CAUSE_ANALYSIS

**Phase:** Production Readiness — Phase 7  
**Generated:** 2026-07-31  
**Rule:** Verified evidence only. Hypotheses labeled. No optimization.

---

## Infrastructure

| Finding | Evidence | Measured impact | Confidence | Label |
| --- | --- | --- | --- | --- |
| Supabase pooler RTT dominates DB waits | SELECT 1 ~328 ms p50; EXPLAIN SQL &lt;1 ms (prior); health DB latency 3051 ms | Hundreds of ms per query; multi-second pages when many queries | High | Runtime Evidence (+ prior) |
| `DIRECT_URL` host unresolved | `ENOTFOUND db.*.supabase.co` | Blocks official migrate tooling from this workstation | High | Runtime Evidence |
| No `LOCAL_DATABASE_URL` | Env audit | Dev uses remote pooler for everything | High | Runtime Evidence |
| Cold `next dev` compile | `/home` compile 2.3 s on 3012 | Inflates first-hit TTFB | High | Runtime Evidence |

---

## Authentication

| Finding | Evidence | Measured impact | Confidence | Label |
| --- | --- | --- | --- | --- |
| Middleware cost ≈ Auth HTTP `getUser` | `getUserNetwork` 310–1361 ms; createClient ≤8 ms | **~0.3–1.3 s every navigation** | High | Runtime Evidence |
| Duplicate Supabase getUser eliminated | `duplicateAuth=no`, routeGetUser=0 | Saves 1 Auth RTT vs pre-Sprint 2 | High | Runtime Evidence |
| Public `/` still calls getUser | Landing headers auth 555 ms | Landing TTFB includes Auth RTT | High | Runtime Evidence |
| Prisma User load blocked by schema | P2022 on findUnique | Authenticated app **unusable** | High | Runtime Evidence |

---

## Database

| Finding | Evidence | Measured impact | Confidence | Label |
| --- | --- | --- | --- | --- |
| Schema drift: missing `preferred_language` | Introspection + migrate diff | Hard 500 on all Main routes | High | Runtime Evidence |
| Pending 0008–0011 objects | migrate diff SQL | media_objects, push cols, unread index missing | High | Runtime Evidence |
| `_prisma_migrations` absent | Introspection | Deploy history blind; migrate status lists all 11 pending | High | Runtime Evidence |
| 0001–0007 objects present without history | Tables exist | Partial/out-of-band apply | High | Runtime Evidence + Static Analysis |
| SQL execution not primary latency | Prior EXPLAIN | &lt;1 ms typical | High | Prior Runtime Evidence |

---

## Application

| Finding | Evidence | Measured impact | Confidence | Label |
| --- | --- | --- | --- | --- |
| Business loaders not reached today | Logs stop at requireUser | Query counts N/A | High | Runtime Evidence |
| Remaining `/home` ~15 queries when healthy | Sprint 4 static + prior traces | ~2–5 s wall under pooler RTT | Medium–High | Prior Runtime Evidence / Static Analysis |
| Further Story mega-merge low value | Sprint 5A Option B | Negligible vs RTT/schema | Medium | Prior analysis |

---

## React

| Finding | Evidence | Measured impact | Confidence | Label |
| --- | --- | --- | --- | --- |
| Invalid hook = cascade from SSR failure | Static audit + prior docs + current 500s | Dev overlay noise; masks real errors | High (dev) | Static Analysis + Prior Runtime |
| Duplicate React not present | `npm ls` | None | High | Static Analysis |
| Discoveries/profile lack page Suspense | Architecture inventory | Longer time-to-content when healthy | Medium | Static Analysis |

---

## Network

| Finding | Evidence | Measured impact | Confidence | Label |
| --- | --- | --- | --- | --- |
| Workstation → us-east-1 path | Pooler host + RTT samples | Structural latency floor | High | Runtime Evidence |
| Auth REST + Postgres both remote | Auth headers + pooler probes | Two independent RTT taxes | High | Runtime Evidence |

---

## Ranked bottlenecks (current reality)

1. **Schema / migration drift** — blocks production use and measurement (**Critical**, Runtime Evidence)  
2. **Supabase Auth getUser RTT** — ~0.3–1.3 s/nav (**High**, Runtime Evidence)  
3. **Supabase Postgres pooler RTT × query count** — dominates when pages work (**High**, Prior + live RTT)  
4. **Dev compile / HMR cascades** — confuses debugging (**Medium**, Runtime Evidence)  
5. **React Invalid hook** — symptom, not root (**Medium**, analysis)

---

## Explicit non-findings

| Hypothesis | Verdict |
| --- | --- |
| Missing `"use client"` causes Invalid hook | **Rejected** (Static Analysis) |
| SQL plans are the main latency source | **Rejected** (Prior EXPLAIN) |
| Unified Story loader required for readiness | **Rejected** as Phase 1 priority (Sprint 5A + current blockers) |
