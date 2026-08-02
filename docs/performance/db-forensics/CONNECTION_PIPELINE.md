# CONNECTION_PIPELINE

Evidence date: 2026-08-01  
Workstation path: Zimbabwe ISP → internet → AWS us-east-1 Supabase pooler  
Artifacts: `artifacts/url-inspect.json`, `artifacts/dns.json`, `artifacts/dns-direct.json`, `artifacts/network.json`

## Pipeline (as configured)

```
test-db.js / Node process
        ↓
PrismaClient (lazy engine connect on first query)
        ↓
PostgreSQL wire protocol client (Prisma engine / libpq-compatible)
        ↓
DNS lookup: aws-1-us-east-1.pooler.supabase.com
        ↓  (CNAME → AWS ELB in us-east-1)
TCP connect :5432  (Node default: autoSelectFamily / Happy Eyeballs)
        ↓
PostgreSQL SSLRequest
        ↓
TLS handshake (SNI = pooler hostname)
        ↓
Startup + auth (SCRAM) against Supabase pooler
        ↓
Supabase Pooler (host implies PgBouncer; port 5432 = session-mode pooler)
        ↓
PostgreSQL (project db)
        ↓
SELECT NOW()
        ↓
Response → client → console.timeEnd
```

## URL configuration (redacted)

| Env var | Host | Port | Role |
|---------|------|------|------|
| `DATABASE_URL` | `aws-1-us-east-1.pooler.supabase.com` | `5432` | App runtime (pooler) |
| `DIRECT_URL` | `db.drzpgydqpryrwobtqbkg.supabase.co` | `5432` | Migrations / direct |

From `artifacts/url-inspect.json`:

- Pooler URL query params: **none** (`pgbouncer=` not present; pooler inferred from hostname).
- User on pooler: `postgres.<project-ref>` (pooler tenant form).
- Direct user: `postgres`.

## What this pipeline is *not*

- Not browser → DB. Browser never talks to Postgres.
- Not Prisma schema / SQL complexity. Statement is `SELECT NOW()`.
- Not application Story/recommendation code. Root `test-db.js` is a bare Prisma query.

## Observability points used

| Stage | Instrument |
|-------|------------|
| DNS | `dns.promises.lookup` / `resolve4` / `resolve6` |
| TCP | `net.connect` + `process.hrtime.bigint()` |
| SSLRequest + TLS | custom PG SSLRequest then `tls.connect` |
| Full PG connect + query | `pg.Client` |
| Prisma | `PrismaClient` + `$queryRaw` wall clock |
| Server SQL | `EXPLAIN (ANALYZE, FORMAT JSON)` |
| Network path | Windows `ping` / `tracert` |
