# DATABASE_URL / DIRECT_URL Configuration Audit

**Date:** 2026-06-20  
**Sources:** `.env`, `.env.local`, `prisma/schema.prisma`, `README.md` (Vercel section), `.env.example`

---

## 1. Current values (secrets redacted)

### `.env`

| Variable | Redacted value |
|----------|----------------|
| `DATABASE_URL` | `postgresql://postgres.***:***@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&prepared_statements=false` |
| `DIRECT_URL` | `postgresql://postgres.***:***@aws-0-eu-west-1.pooler.supabase.com:5432/postgres` |

### `.env.local`

Same `DATABASE_URL` and `DIRECT_URL` as `.env` (no override of connection params). Additional app vars present (`NEXT_PUBLIC_APP_URL`, email, admin).

### `prisma/schema.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### Vercel documentation (in-repo)

| Source | Guidance |
|--------|----------|
| `README.md` § Deploying to Vercel | Copy all env vars from `.env.local`; pooled `pgbouncer=true` recommended for serverless |
| `README.md` § Getting started | Pooled string → `DATABASE_URL` (6543); direct → `DIRECT_URL` (5432) |
| `.env.example` | Documents `pgbouncer=true&connection_limit=1` on `DATABASE_URL` |

No separate `vercel.json` env file exists. Production values must be set manually in the Vercel project dashboard and should match the corrected strings below.

---

## 2. Verification checklist

| Check | Expected | `.env` / `.env.local` | Result |
|-------|----------|------------------------|--------|
| `DATABASE_URL` uses transaction pooler | Port **6543**, pooler host | `aws-0-eu-west-1.pooler.supabase.com:6543` | **Pass** |
| `pgbouncer=true` on `DATABASE_URL` | Required for Prisma + Supabase pooler | Present | **Pass** |
| `connection_limit=1` on `DATABASE_URL` | Required for serverless / Vercel | **Missing** | **Fail** |
| `DIRECT_URL` uses direct/session port | Port **5432** | `...pooler.supabase.com:5432` | **Pass** |
| Prisma runtime uses `DATABASE_URL` | `url = env("DATABASE_URL")` + `lib/prisma.ts` | Schema + client use implicit datasource | **Pass** |
| Prisma migrations use `DIRECT_URL` | `directUrl = env("DIRECT_URL")` | Schema declares `directUrl` | **Pass** |

### Additional observations

| Item | Status | Notes |
|------|--------|-------|
| `prepared_statements=false` | OK | Valid for PgBouncer transaction mode; not in `.env.example` but recommended with Prisma |
| Duplicate `.env` + `.env.local` DB URLs | Warning | Same values in both; prefer single source in `.env.local` only |
| Vercel env parity | Unknown | Must be verified in dashboard; likely missing `connection_limit=1` if copied from current local files |
| `DIRECT_URL` host | OK | Supabase documents pooler hostname for both 6543 and 5432 |

---

## 3. Problems found

### P1 — Missing `connection_limit=1` (Critical for Vercel)

**Current:**

```
?pgbouncer=true&prepared_statements=false
```

**Expected (per `.env.example` and Supabase serverless guidance):**

```
?pgbouncer=true&connection_limit=1&prepared_statements=false
```

Without `connection_limit=1`, each serverless invocation can open multiple Prisma connections and exhaust the Supabase pooler, causing P1001 timeouts and multi-second `SELECT 1` latency.

### P2 — Vercel env not documented with required query params

README says “add same env vars as `.env.local`” but does not call out `connection_limit=1`. Operators may deploy with an incomplete pooled URL.

### P3 — `.env.example` omits `prepared_statements=false`

Local env includes it (good); example file should document both params for copy-paste accuracy.

### P4 — High connect latency (infra, not URL shape)

Live latency benchmark (see §4) shows `SELECT 1` p95 in the **multi-second** range. URL shape is mostly correct except `connection_limit`; remaining slowness is **infrastructure/network/pooler load**, not missing `directUrl` wiring.

---

## 4. Latency benchmark results

Run: `npm run check-db-latency` (or `npx tsx scripts/check-db-latency.ts`)

**Executed:** 2026-06-20 (local Windows → Supabase eu-west-1 pooler)

| Query | min | avg | p95 | max |
|-------|-----|-----|-----|-----|
| `SELECT 1` | 1,178 ms | 1,375 ms | 3,022 ms | 3,022 ms |
| `adminSettings.findUnique({ id: 1 })` | 1,440 ms | 3,295 ms | 9,343 ms | 9,343 ms |
| `story.count()` | 1,185 ms | 1,228 ms | 1,464 ms | 1,464 ms |

### Interpretation

| Layer | Verdict | Evidence |
|-------|---------|----------|
| **Infrastructure** | **SLOW** | `SELECT 1` steady ~1.18–1.22s on 9/10 runs; p95 inflated by one 3.0s outlier. Target for healthy pooler: **<100ms**. |
| **Application (story.count)** | **Not the bottleneck** | `story.count()` tracks `SELECT 1` within ~50ms on most runs — query work is negligible vs connect latency. |
| **Application (adminSettings)** | **Mostly infra** | Single-row PK lookup; high variance (1.4–9.3s) matches pooler queueing, not SQL complexity. |

**Conclusion:** Current latency is **primarily infrastructure / pooler connect cost**, not application query logic. Fixing `connection_limit=1` and pooler reachability should improve all three metrics together. Re-run `check-db-latency` after env fix; if `SELECT 1` p95 drops below 100ms but `story.count` stays high, revisit indexes.

---

## 5. Exact corrected connection strings

Replace `YOUR_PASSWORD` with the database password from Supabase **Project Settings → Database**. URL-encode special characters in the password (e.g. `*` → `%2A`).

### Local (`.env.local`) and Vercel — `DATABASE_URL` (runtime)

```
postgresql://postgres.ssviggmfvffaxhibejyk:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&prepared_statements=false
```

### Local and Vercel — `DIRECT_URL` (migrations / `prisma migrate` / `db push` only)

```
postgresql://postgres.ssviggmfvffaxhibejyk:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

### Vercel dashboard steps

1. **Project → Settings → Environment Variables**
2. Set `DATABASE_URL` to the **6543** string above (Production, Preview, Development)
3. Set `DIRECT_URL` to the **5432** string above (all environments)
4. Redeploy after changing database URLs

### Optional: keep `.env` free of secrets

Delete DB URLs from `.env`; keep credentials only in `.env.local` (gitignored).

---

## 6. Prisma wiring confirmation

| Operation | Connection used | Mechanism |
|-----------|-----------------|-----------|
| `next dev` / `next start` / API routes | `DATABASE_URL` (6543 pooler) | `PrismaClient` → schema `url` |
| `prisma migrate deploy` | `DIRECT_URL` (5432) | schema `directUrl` |
| `prisma db push` | `DIRECT_URL` | schema `directUrl` |
| `prisma generate` | Neither (no DB) | — |

`lib/prisma.ts` does not override the datasource; it correctly relies on schema env vars.

---

## 7. Recommended actions

1. Add `connection_limit=1` to `DATABASE_URL` in `.env.local` and Vercel.
2. Update `.env.example` to include `prepared_statements=false`.
3. Run `npx tsx scripts/check-db-latency.ts` after the change; target SELECT 1 p95 **< 100ms**.
4. If latency remains high, check Supabase status, region (eu-west-1), VPN/firewall, and pooler connection count in Supabase dashboard.
