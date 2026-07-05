# BuddyIntro Capacity Report

Generated: 2026-06-23T05:18:53.346Z

Based on measured concurrency tests against production build (`PROFILE_PRODUCTION=1`), 1000-user simulation dataset, auth pool of 100 pre-logged-in sim users.

---

## Route test ratings (PASS / WARNING / FAIL)

Thresholds: error rate ≤1%, p95 ≤2000ms (10–25 VUs), ≤2500ms (50 VUs), ≤3000ms (100 VUs)

| Concurrent users | Rating | Median ms | p95 ms | Error rate | RPS |
| ---------------- | ------ | --------- | ------ | ---------- | --- |
| 10 | **PASS** | 339 | 527 | 0.00% | 25.68 |
| 25 | **PASS** | 520 | 1035 | 0.00% | 40.72 |
| 50 | **WARNING** | 981 | 2449 | 0.00% | 39.75 |
| 100 | **WARNING** | 1782 | 5284 | 0.00% | 39.08 |

Route tests sustain **0% errors** through 100 VUs but latency grows super-linearly (event-loop saturation).

---

## Journey test ratings (25 / 50 / 100 VUs, 300s)

Realistic flow: Home → Discoveries → Profile → Message Context → Introductions (800–2500ms pauses).

| Concurrent users | Rating | p95 ms | Error rate | Notes |
| ---------------- | ------ | ------ | ---------- | ----- |
| 25 | **PASS** | 448 | 0.00% | Safe sustained load |
| 50 | **FAIL** | 2709 | 20.25% | Timeouts / overload |
| 100 | **FAIL** | 12 | 100.00% | Server unreachable (crash) |

**Realistic safe concurrency (journey): ~25 concurrent users** on a single Node instance.

---

## Capacity estimates (from measured data)

| Environment | Safe concurrent | Max daily active (est.) | Expected p95 |
| ----------- | ----------------- | ----------------------- | ------------ |
| Shared hosting + Supabase Free | **10–15** | 200–400 | 800–1500ms |
| Shared hosting + Supabase Pro | **15–25** | 500–800 | 700–1200ms |
| VPS 2GB RAM (1× Node) | **20–30** | 800–1,500 | 600–1000ms |
| VPS 4GB RAM (1× Node) | **30–40** | 2,000–3,000 | 500–900ms |
| VPS 8GB RAM (2× Node + pooler) | **75–100** | 5,000–8,000 | 400–700ms |

Assumptions: cross-region auth RTT ~250–550ms under load, one app instance unless noted, 1000-user DB.

---

## Hosting readiness

| Target | Rating | Rationale |
| ------ | ------ | --------- |
| Shared hosting + Supabase | **FAIL** for >15 concurrent | Pool limits, auth RTT, no horizontal scale |
| VPS 2GB | **WARNING** | OK for beta ≤25 concurrent journey users |
| VPS 4GB | **WARNING** | Route tests OK to 50 VUs; journeys fail at 50 |
| VPS 8GB (2× Node) | **PASS** (estimated) | Required for 50+ concurrent journeys |

---

## Recommended hosting for launch

**Minimum:** VPS 4GB (eu-west-1, colocated with Supabase) + connection pooler  
**Comfortable:** VPS 8GB, 2× Node behind Caddy/nginx, Supabase Pro pooler

---

*Raw: `docs/.concurrency-test-results.json`*
