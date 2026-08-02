# Database Connection Benchmark

**Generated:** 2026-07-26T07:19:50.247Z  
**Runs:** 10 per connection target

---

## Configuration

| Variable | Redacted URL | Host |
|----------|--------------|------|
| DATABASE_URL | postgresql://postgres.***:***@aws-1-us-east-1.pooler.supabase.com:5432/postgres | aws-1-us-east-1.pooler.supabase.com:5432 |
| DIRECT_URL | postgresql://postgres.***:***@aws-1-us-east-1.pooler.supabase.com:5432/postgres | aws-1-us-east-1.pooler.supabase.com:5432 |
| Identical? | **YES — both use pooler** | |

---

## Phase 1 — Raw pg Client (connect + SELECT 1)

### DATABASE_URL


| Metric | min | avg | p50 | p95 | p99 | max |
|--------|-----|-----|-----|-----|-----|-----|
| Connection acquisition | 2675 | 2675 | 2675 | 2675 | 2675 | 2675 |
| Query execution (total) | 278 | 307 | 288 | 365 | 365 | 365 |
| Total round trip | 278 | 574 | 288 | 2979 | 2979 | 2979 |

**SQL execution time (EXPLAIN ANALYZE):** 0.037ms


### DIRECT_URL


| Metric | min | avg | p50 | p95 | p99 | max |
|--------|-----|-----|-----|-----|-----|-----|
| Connection acquisition | 2563 | 2563 | 2563 | 2563 | 2563 | 2563 |
| Query execution | 277 | 311 | 307 | 380 | 380 | 380 |
| Total round trip | 277 | 568 | 307 | 2943 | 2943 | 2943 |

**SQL execution time:** 0.02ms


### Local PostgreSQL

LOCAL_DATABASE_URL not configured

### VPS PostgreSQL

VPS_DATABASE_URL not configured

---

## Prisma Client (DATABASE_URL)

| Query | avg 612ms · p50 305ms · p95 3385ms · p99 3385ms · max 3385ms |
|-------|---|
| AdminSettings.findUnique | avg 349ms · p50 308ms · p95 692ms · p99 692ms · max 692ms |

---

## Phase 4 — Page Benchmarks

**Base URL:** http://localhost:3000  
**Server available:** No

| Page | Status | TTFB | Total | Prisma hdr | Auth hdr |
| --- | --- | --- | --- | --- | --- |
| / | fetch failed | — | — | — | — |
| /home | fetch failed | — | — | — | — |
| /discoveries | fetch failed | — | — | — | — |
| /profile | fetch failed | — | — | — | — |
| /messages | fetch failed | — | — | — | — |
| /introductions | fetch failed | — | — | — | — |

**Note:** Enable `PROFILE_PRODUCTION=1` on production build for prisma/auth header breakdown.

---

## Interpretation

| Layer | Share of round-trip |
|-------|---------------------|
| Network RTT to pooler | **~95%** |
| Connection acquisition | Included in connect+query |
| SQL execution | **<1%** |
| Prisma ORM | **~246ms** (~40% of total) |
