# Connection Pool Audit

**Generated:** 2026-07-26T06:37:26.870Z

---

## Configuration

| Setting | Value |
|---------|-------|
| Pooler host | 2020@aws-1-us-east-1.pooler.supabase.com:5432 |
| pgbouncer param | (missing) |
| connection_limit param | (missing) |
| DIRECT_URL = DATABASE_URL | **Yes** (same pooler path) |

---

## Latency Under Concurrency

| Test | Min | Avg | P95 | Max |
|------|-----|-----|-----|-----|
| 10× parallel SELECT 1 | 554ms | 1290ms | 2733ms | 2733ms |

---

## Findings

- DIRECT_URL points to pooler — migrations/EXPLAIN use same path as runtime
- Supabase pooler RTT dominates single-query latency (see SELECT 1 p95)
- Prisma default pool: connection_limit not set in DATABASE_URL query string

---

## pg_stat_activity Snapshot

```json
{
  "active": "2",
  "client_wait": "20",
  "total": "23"
}
```

---

## Conclusion

**Supabase pooler is the bottleneck** for localhost development. Connection wait is less visible than per-query RTT inflation. Production VPS co-location with DB region would reduce RTT; query-count reduction remains the primary application-level lever regardless of region.
