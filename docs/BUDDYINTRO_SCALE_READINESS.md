# BuddyIntro Scale Readiness

Generated: 2026-06-22T22:51:41.981Z

Based on measured progressive tests: 50, 50, 50, 50, 100, 100, 100, 100, 250, 250, 250, 500, 500, 1000 simulation users.

---

## Verdict by scale

| Scale | Health | Validation | Home TTFB (warm) | Connections |
| ----- | ------ | ---------- | ---------------- | ----------- |
| 50 users | **Healthy** | 50/50 | 350ms | 2450 |
| 100 users | **Healthy** | 100/100 | 391ms | 9886 |
| 250 users | **Healthy** | 250/250 | 287ms | 61050 |
| 500 users | **Healthy** | 500/500 | 302ms | 249500 |

---

## Questions

### 1. Is BuddyIntro healthy at 50 users?

**Healthy** — All loader validations passed. Home TTFB 350ms dominated by auth (~280ms).

### 2. Is BuddyIntro healthy at 100 users?

**Healthy** — Validation passed.

### 3. Is BuddyIntro healthy at 250 users?

**Healthy** — Validation passed.

### 4. Is BuddyIntro healthy at 500 users?

**Healthy** — Validation passed.

### 5. Most likely bottleneck before 1000 users?

**Middleware Supabase auth RTT** (~268ms measured at largest scale) — fixed per request, independent of dataset size. Secondary: **materialized trust graph size** (super-linear `user_connections` growth) affecting discovery/trust query fan-out.

### 6. Estimated safe user count today

**Functional:** 500+ simulation users with passing validation (if 500 scale passes).  
**Performance (acceptable TTFB):** ~**250–500 users** in current deployment topology before graph/query costs add significantly on top of auth RTT.  
**Public launch comfortable target:** **250 users** without infra changes; **500+** requires auth RTT fix (region colocation or JWT verify).

### 7. Top 10 performance improvements before public launch

1. **P0:** Pin production compute to Supabase region (eu-west-1) — −200ms+ auth per request
2. **P0:** Matcher exclude health/manifest/offline/icons from middleware auth
3. **P1:** Local JWT verification in middleware (eliminate per-request `getUser()` RTT)
4. **P1:** Cap or lazy-build `user_connections` BFS materialization depth/size
5. **P2:** Discoveries author ID cache per viewer session
6. **P2:** Dedupe `User.findUnique` in message context route
7. **P2:** Consolidate home layout badge queries (single round-trip)
8. **P3:** Index audit on `user_connections(source_user_id, degree)` under load
9. **P3:** Stream heavy SSR sections (already partially done on home)
10. **P3:** Connection pool `connection_limit=1` on Vercel (prevents pool exhaustion at scale)

---

*Source data: `docs/SCALABILITY_TEST_RESULTS.md`, `docs/.scale-progression-results.json`*
