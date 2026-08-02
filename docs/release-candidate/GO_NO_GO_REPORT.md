# GO_NO_GO_REPORT — RC-1

**Date:** 2026-07-31  
**Decision (exactly one):**

# GO WITH MAJOR FIXES

---

## Rationale

The product shell, auth gates, PWA manifest/SW, security redirects, and empty-state UX are **release-caliber**. Two application defects found in this RC were **fixed** (CSRF loopback; authenticated shell crash on DB blip).

However, **core mutating journeys could not be certified** in this environment because the Supabase pooler was intermittently unreachable (`P1001`, multi-second latency). Shipping to real users without a green VPS re-cert of upload / discovery post / messaging send would be irresponsible.

---

## Blockers ranked (highest → lowest)

| Rank | ID | Severity | Item | Effort |
| --- | --- | --- | --- | --- |
| 1 | RC3-INFRA-001 | Critical | Stabilize Postgres pooler / region latency for production traffic | **Ops** — 0.5–2 days (pooler settings, region, connection string, monitoring) |
| 2 | RC3-004 | High | Return structured **503** JSON on mutating APIs when DB is down | **App** — 2–4 hours |
| 3 | — | High | Re-run browser E2E on production origin: upload, story create, discovery post, message send, push | **QA** — 0.5–1 day on VPS |
| 4 | RC3-005 | Medium | Redis degraded / optional path clarity | **Ops** — 1–4 hours |
| 5 | RC3-007 / RC3-008 | Low | Inline login errors; polish file picker | **App** — 2–4 hours |

**Already fixed this RC (must ship):** RC3-001, RC3-002, RC3-003.

---

## What “GO” would require

1. Deploy RC3 fixes to production VPS  
2. Health `database: healthy` (or consistently degraded&lt;100ms) from the app host  
3. Green `rc-mutate-smoke.mjs` + browser story/discovery/message pass  
4. Confirm push VAPID + one real device delivery  

Until then: **GO WITH MAJOR FIXES** (not NO GO — product is close; infra + re-cert remain).

---

## Alternatives considered

| Option | Why not |
| --- | --- |
| **GO** | Mutating journeys uncertified under live outage |
| **GO WITH MINOR FIXES** | Infra outage + API 500 envelope are not “minor” |
| **NO GO** | Overstates — auth, pages, PWA, empty states, and two critical app bugs were addressed |
