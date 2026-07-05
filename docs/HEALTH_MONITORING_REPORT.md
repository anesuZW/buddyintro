# Health Monitoring Report

Generated: 2026-06-23

## Endpoints implemented

### `GET /api/health`

Production probe shape (default):

```json
{
  "status": "healthy",
  "database": "healthy",
  "supabase": "healthy",
  "memory": {
    "heapUsedMb": 142.3,
    "heapTotalMb": 180.0,
    "rssMb": 210.5
  },
  "uptime": 3600,
  "checkedAt": "2026-06-23T10:00:00.000Z"
}
```

Checks performed:

| Check | Implementation |
| ----- | -------------- |
| Database | `prisma.$queryRaw SELECT 1` |
| Supabase | Auth `/auth/v1/health` + storage bucket list |
| Memory | `process.memoryUsage()` |
| Uptime | `process.uptime()` |

Extended diagnostics: `GET /api/health?verbose=1` (queue depth, graph materialization, analytics)

HTTP status: **200** for `healthy`/`degraded`, **503** for `unhealthy`.

**Middleware:** `/api/health` excluded from auth middleware (see `MIDDLEWARE_EXCLUSION_REPORT.md`).

### `GET /api/bench/runtime`

Enabled when `HEALTH_MONITORING=1` or `PROFILE_PRODUCTION=1`.

Response:

```json
{
  "heapUsed": 142.3,
  "heapTotal": 180.0,
  "rss": 210.5,
  "eventLoopLag": 1.2,
  "eventLoopLagP99": 4.5,
  "uptime": 3600,
  "prisma": { "totalQueries": 120, "avgQueryMs": 3.2 }
}
```

Reset Prisma counters: `GET /api/bench/runtime?reset=prisma`

## Files changed

| File | Change |
| ---- | ------ |
| `services/health.ts` | `getProductionHealthSummary()`, Supabase auth ping |
| `app/api/health/route.ts` | Simplified JSON response |
| `app/api/bench/runtime/route.ts` | Simplified metrics + `HEALTH_MONITORING` gate |
| `lib/profile/production-benchmark.ts` | `isRuntimeMetricsEnabled()` |

## Production usage

```bash
# Uptime monitor (every 60s)
curl -sf https://buddyintro.com/api/health | jq .status

# Runtime diagnostics (internal only — do not expose publicly without auth)
HEALTH_MONITORING=1 curl -sf https://buddyintro.com/api/bench/runtime
```

## Status

**PASS** — Health and runtime endpoints implemented per launch spec.
