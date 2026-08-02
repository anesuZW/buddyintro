# Infrastructure Recommendations

**Generated:** 2026-07-26T07:19:50.247Z  
**Status:** RECOMMENDATIONS ONLY — **NOT IMPLEMENTED**

---

## Primary Recommendation

**Fix Supabase connection topology before application code optimization.**

Current measured pooler RTT (avg **305ms**) makes every Prisma call expensive regardless of SQL efficiency.

---

## Pooler vs Direct URL

| Workload | Recommended connection | Rationale |
|----------|------------------------|-----------|
| SSR / API reads | **Pooler** (DATABASE_URL with `pgbouncer=true`) | Many short queries |
| Writes (API) | **Pooler** | Standard app path |
| Migrations | **Direct** (non-pooler DIRECT_URL) | DDL not supported on transaction pooler |
| EXPLAIN / DBA scripts | **Direct** | Avoid pooler queue in diagnostics |
| Background jobs (long) | **Direct** | Don't hold pooler slots |

### Required env change (recommended, not applied)

```
DATABASE_URL=postgresql://...@aws-0-...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10
DIRECT_URL=postgresql://...@db....supabase.co:5432/postgres
```

**Current state:** DIRECT_URL = DATABASE_URL (same pooler) — **misconfigured for Prisma best practice**.

---

## Read Strategy

- Keep all page SSR reads on pooler after RTT fix
- Use same-region deployment (app server in us-east-1 with Supabase project)
- Target SELECT 1 p95 **<100ms** before Sprint 2

---

## Write Strategy

- Short writes on pooler (messages, analytics, notifications)
- Batch analytics via existing job worker (Sprint 5)
- Never run `rebuildUserConnections` on request path

---

## Local PostgreSQL for Development

| Option | Recommendation |
|--------|----------------|
| **Docker Postgres locally** | **Recommended** for dev — eliminates 455ms RTT during feature work |
| **Supabase pooler from localhost** | Current setup — acceptable for integration testing only |
| **LOCAL_DATABASE_URL** | Add optional env for `npm run dev` when doing non-DB feature work |

LOCAL_DATABASE_URL not set — consider `docker run postgres:16` for local dev

---

## Expected Impact (If Recommendations Applied)

| Metric | Current | Projected |
|--------|---------|-----------|
| Pooler RTT avg | 305ms | 40–80ms (same region) |
| /home DB time (18 queries) | ~5490ms | ~720–1440ms |
| Sprint 2–5 code optimizations | Multiplied on top | Additional 30–40% query reduction |

---

## Do NOT Implement in Sprint 1

Sprint 1 is measurement only. These recommendations feed Sprint 1 infra tasks before Sprint 2 auth work.

---

## Approval Gate for Sprint 2

Proceed to Sprint 2 when:

- [ ] This report reviewed
- [ ] Connection strategy decided (pooler port 6543 + separate DIRECT_URL OR local dev DB)
- [ ] Baseline artifact saved: `docs/performance/sprint-1/artifacts/infrastructure-validation.json`
