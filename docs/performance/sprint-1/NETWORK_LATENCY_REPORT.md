# Network Latency Report

**Generated:** 2026-07-26T07:19:50.247Z

---

## TCP Probes

| Target | Host | Port | Latency | OK |
| --- | --- | --- | --- | --- |
| DATABASE_URL (pooler) | aws-1-us-east-1.pooler.supabase.com | 5432 | 1043ms | ✓ |

---

## Supabase Auth Health

```json
{
  "status": 401,
  "latencyMs": 672
}
```

---

## Direct vs Pooler

| Check | Result |
|-------|--------|
| DIRECT_URL same host as DATABASE_URL | **YES** |
| Separate direct DB endpoint configured | **NO** |

---

## Localhost vs Remote

| Environment | Status |
|-------------|--------|
| Dev machine → Supabase us-east-1 pooler | Measured (see DATABASE_CONNECTION_BENCHMARK) |
| Local PostgreSQL | **Not configured** — set LOCAL_DATABASE_URL for dev comparison |
| VPS PostgreSQL | **Not configured** — set VPS_DATABASE_URL when VPS provisioned |

---

## Phase 3 Summary

Raw network latency to the pooler endpoint is the primary variable. TCP connect times correlate with total query latency. Supabase Auth health check measures REST path separately from Postgres pooler.
