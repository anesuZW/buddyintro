# Runtime Limitations

**Generated:** 2026-07-26T18:05:00.000Z

---

## Infrastructure issues

| Issue | Error | When |
| --- | --- | --- |
| Pooler intermittent failure | `Can't reach database server at aws-1-us-east-1.pooler.supabase.com:5432` | 2026-07-26T16:33Z prior capture; `profile:database` connection audit |
| Pooler slow (not down) | SELECT 1 p95=3,109ms | 2026-07-26 verification session |
| Cold Next.js compile | `/home` compile 28.8s | Port 3010 first request |

---

## Affected phases

| Phase | Impact | Status |
| --- | --- | --- |
| ACTUAL_PRISMA_TRACE — SQL | Prisma client does not log query text | **UNVERIFIED** fields |
| ACTUAL_PRISMA_TRACE — rows | No row-count instrumentation | **UNVERIFIED** |
| SQL_VERIFICATION — live EXPLAIN | Standalone PrismaClient could not connect during audit script | **BLOCKED** — use HISTORICAL DATA |
| RECOMMENDATION_STABILITY | No dual-path runtime snapshot | **UNVERIFIED** |
| REGRESSION — RC1/RC2 | Not executed | **UNVERIFIED** |
| PERFORMANCE — controlled A/B | Cold compile invalidated HTTP comparison | **UNVERIFIED** for latency claims |
| `/api/bench/metrics/{id}` | 401 without session cookie | Bench JSON not retrieved |

---

## What succeeded despite limitations

| Capture | Result |
| --- | --- |
| GET /home authenticated | **200** |
| `[prisma:slow]` server log | 18 operations with durations |
| StoryTag.findMany count | **2** (RUNTIME VERIFIED) |
| Auth profile | duplicateAuth=no |
| Unit tests | 3/3 pass |
| check-db-latency | Connected (587ms avg SELECT 1) |

---

## Blocked conclusions (marked UNVERIFIED)

- Per-query generated SQL
- Per-query bind parameters
- Per-query rows returned
- Live EXPLAIN on consolidated Scan A/B
- Introduction suggestion ID equality vs pre-Sprint 3
- RC1/RC2 pass/fail
- CPU / memory / render segment timings
- Controlled Sprint 2 vs Sprint 3 HTTP latency delta

---

## Reproduction when unblocked

```powershell
$env:PROFILE_PRODUCTION='1'; $env:AUTH_PROFILE='1'; npm run dev -- -p 3010
# Warm server with one request, then:
npx tsx scripts/capture-http-profile.ts --base=http://localhost:3010
npm run profile:database -- --skip-server --base=http://localhost:3010
npx tsx --test tests/home-story-context.test.ts
```

**Note:** Full SQL trace requires instrumentation change (out of scope for this read-only audit).
