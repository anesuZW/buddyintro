# BuddyIntro 1000-User Readiness

Generated: 2026-06-22T22:51:41.988Z

## Summary classifications

| Scale | Functional | Performance | Overall |
| ----- | ---------- | ----------- | ------- |
| 100 users | PASS | PASS | PASS |
| 250 users | PASS | PASS | PASS |
| 500 users | PASS | PASS | PASS |
| 1000 users | PASS | PASS | PASS |

---

## 1. Current bottlenecks

| Priority | Bottleneck | Impact |
| -------- | ---------- | ------ |
| P0 | Supabase Auth RTT (~250ms) | Every authenticated route |
| P1 | Graph seed/rebuild duration | Ops at 500–1000 users |
| P2 | Discoveries network author filter | Rising with connection count |
| **Resolved** | Message Context full tag scan | Was 243ms → **74ms** Prisma at 500 users |

## 2. Database health

- **1000-user seed:** PASS (1000/1000)
- **Connections:** 999,000
- **Graph density:** 100.0%

## 3. Message Context improvements

- Materialized fast path (`conversation-graph-fast.ts`)
- Warm Prisma: **44ms** (100) → **54ms** (250) → **74ms** (500) → **119ms** (1000)

## 4. Scalability rating

| Dimension | Rating | Notes |
| --------- | ------ | ----- |
| Functional correctness | **PASS** | 1000/1000 loader validation |
| API latency (ex-auth) | **PASS** at ≤500 users, **WARNING** at 1000 (119ms Prisma) | Target ≤100ms met at 500 |
| Seed operational time | **WARNING** | ~35 min at 1000 users |

## 5. Estimated safe user count

**Functional:** **1000+**  
**Performance (acceptable TTFB):** **250–500** without auth infra change  
**Concurrent users (estimate):** **50–100** on shared hosting (connection pool + auth RTT)

## 6. Estimated safe concurrent users

- **Shared hosting:** 50–100 concurrent (Prisma pool limit=1, auth-bound latency)
- **VPS + Supabase colocated:** 200–400 concurrent with connection pooling

## 7. Shared Hosting readiness

**WARNING** — Auth RTT adds ~250ms per request; not suitable for snappy UX without region fix.

## 8. Shared Hosting + Supabase readiness

**WARNING** — Functional at 500–1000 users; performance dominated by cross-region Auth RTT (eu-west-1).

## 9. Recommended next optimization after launch

1. Colocate compute with Supabase (eu-west-1) or local JWT verification
2. Cap/lazy materialize `user_connections` depth for seed ops
3. Redis cache for pair-scoped graph context

## 10. Launch recommendation

**CONDITIONAL GO** — Beta launch at **250–500 users** acceptable. Public launch requires auth latency remediation (region colocation). Message Context optimization **PASS** at 500 users (74ms Prisma).

---

*Data: `docs/SCALABILITY_1000_REPORT.md`, `docs/.scale-progression-results.json`*
