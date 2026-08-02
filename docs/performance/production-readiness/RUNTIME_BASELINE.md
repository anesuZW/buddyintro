# RUNTIME_BASELINE

**Phase:** Production Readiness — Phase 6  
**Generated:** 2026-07-31  
**Mode:** READ-ONLY

---

## Status: AUTHENTICATED BASELINE BLOCKED

All Main-layout authenticated pages return **HTTP 500** because `users.preferred_language` is missing.

A trustworthy **success-path** runtime baseline for `/home`, `/discoveries`, `/messages`, `/profile` **cannot** be established until schema drift is resolved.

Below: (A) what was measured live today, (B) last successful historical reference (labeled separately).

---

## A. Live capture 2026-07-31 (`http://127.0.0.1:3012`)

Label: **Runtime Evidence** (failure path)

| Page | Status | TTFB/total | Middleware auth | Story.findMany | Notes |
| --- | --- | --- | --- | --- | --- |
| `/home` | 500 | 4892 / 4895 | 548 ms (getUserNet 528) | **0** (not reached) | P2022 in `requireUser` |
| `/discoveries` | 500 | 3942 / 3948 | 343 ms | 0 | same |
| `/messages` | 500 | 2422 / 2422 | 305 ms | 0 | same |
| `/profile` | 500 | 2651 / 2651 | 357 ms | 0 | same |
| `/` (landing) | 200 | 7789* / 7795 | 555 ms | 0 | *cold compile |

HTTP capture batch (same blocker): home 3684, discoveries 1978, messages 1713, profile 5431 ms totals — all **500**.

### Infrastructure samples (live)

| Metric | Value | Label |
| --- | --- | --- |
| `/api/health` databaseLatencyMs | 3051 | Runtime Evidence |
| Pooler SELECT 1 p50 (Performance Reset) | 328 ms | Runtime Evidence (prior same day) |
| Supabase Auth getUser network | 310–1361 ms | Runtime Evidence |
| Heap (health) | ~442 MB used | Runtime Evidence |
| CPU | **Unverified** this session | — |
| Render time (success RSC) | **Unverified** | pages fail before render |

### Query counts (live authenticated)

| Metric | Value |
| --- | --- |
| Total Prisma (business) | **0** (auth User.findUnique errors) |
| Story.findMany | 0 |
| StoryTag.findMany | 0 |
| UserConnection.findMany | 0 |
| SharedIntroducerRelationship | 0 |
| Total DB time (success path) | **N/A** |

---

## B. Last successful authenticated reference (NOT today)

Source: Sprint 3 verification `2afc354d` + Sprint 4 static estimates.  
Label: **Prior Runtime Evidence** / **Static Analysis** — use only for relative history, not as current baseline.

| Metric | Sprint 3 runtime | Sprint 4 static est. |
| --- | --- | --- |
| `/home` status | 200 (cold) | — |
| Story.findMany | 5 | **4** |
| StoryTag.findMany | 2 | 2 |
| UserConnection.findMany | 2 | 1 |
| Total Prisma approx | ~17–18 | **~15** |
| Warm TTFB | **2,344 ms** (Sprint 3) | Unverified post-S4 |
| Cold TTFB | 43,395 ms | compile-dominated |

---

## Network / Supabase RTT (current)

| Source | Value |
| --- | --- |
| Pooler RTT class | ~300–450 ms / round-trip |
| Auth RTT class | ~300–550 ms typical |
| Combined tax before any page data | **~0.8–1.5 s** minimum on Main routes |

---

## Baseline declaration

| Item | Declaration |
| --- | --- |
| Production readiness runtime baseline | **NOT ESTABLISHED** |
| Failure-path baseline | **Established** (schema 500 + auth timings) |
| Next action to unblock | Apply pending migrations 0008–0011 (esp. 0009) per ops docs, then re-run this phase |

Artifact: `artifacts/http-capture-2026-07-31.json`, `artifacts/auth-runtime-capture.json`.
